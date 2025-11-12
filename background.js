// タブのキャプチャ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('キャプチャエラー:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true; // 非同期レスポンスを示す
  }

  if (message.action === 'openSlackCustomize') {
    const workspace = message.workspace;
    const url = `https://${workspace}.slack.com/customize/emoji`;
    chrome.tabs.create({ url: url }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('タブ作成エラー:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }
});
