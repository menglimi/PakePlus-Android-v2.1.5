
/**
 * 文本转语音 (TTS) 分发器
 * 支持浏览器原生、OpenAI、及预留的讯飞接入
 */
export async function speakText(text: string, config: any): Promise<void> {
    const { provider, apiKey, apiSecret, appId, voiceId } = config || {};

    if (!text) return;

    // 路径 1: 浏览器原生 (SpeechSynthesis) - 免费、离线、稳定
    if (!provider || provider === 'browser') {
        return new Promise((resolve) => {
            // 停止之前的播放
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            utterance.rate = 1.1; 
            utterance.pitch = 1.0;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
    }

    // 路径 2: OpenAI TTS (高品质情感合成)
    if (provider === 'openai') {
        try {
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'tts-1', input: text, voice: voiceId || 'alloy' })
            });
            const blob = await res.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            return new Promise((r) => { 
                audio.onended = () => r(); 
                audio.onerror = () => r();
                audio.play(); 
            });
        } catch (e) {
            console.error("OpenAI TTS 失败，回退至浏览器引擎");
            return speakText(text, { provider: 'browser' });
        }
    }

    // 路径 3: 讯飞 (Xunfei) - 预留流式架构
    // 由于讯飞需要复杂的 HMAC-SHA256 签名，推荐通过 API 转发器接入或引入 CryptoJS
    if (provider === 'xunfei') {
        console.warn("讯飞 WebAPI 模式已预留。建议在 constants 中配置 Relay 中转，或使用 browser 原生引擎。");
        // 如果未实现签名，自动回退
        return speakText(text, { provider: 'browser' });
    }
}
