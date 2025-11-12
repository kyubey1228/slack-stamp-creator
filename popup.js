// 設定の読み込み
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(['workspace']);
  if (settings.workspace) {
    document.getElementById('workspace').value = settings.workspace;
  }
});

// 設定の保存
document.getElementById('saveSettings').addEventListener('click', async () => {
  const workspace = document.getElementById('workspace').value.trim();
  
  if (!workspace) {
    showStatus('ワークスペース名を入力してください', 'error');
    return;
  }
  
  await chrome.storage.sync.set({ workspace });
  
  showStatus('設定を保存しました', 'success');
});

// 画像キャプチャ
document.getElementById('captureImage').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showStatus('アクティブなタブが見つかりません', 'error');
      return;
    }

    // コンテンツスクリプトにキャプチャ開始を通知
    chrome.tabs.sendMessage(tab.id, {
      action: 'startCapture',
      mode: 'image'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('メッセージ送信エラー:', chrome.runtime.lastError);
        showStatus('キャプチャを開始できませんでした。ページを更新してください。', 'error');
      } else {
        window.close();
      }
    });
  } catch (error) {
    console.error('画像キャプチャエラー:', error);
    showStatus('エラー: ' + error.message, 'error');
  }
});

// 動画キャプチャ
document.getElementById('captureVideo').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showStatus('アクティブなタブが見つかりません', 'error');
      return;
    }

    // コンテンツスクリプトにキャプチャ開始を通知
    chrome.tabs.sendMessage(tab.id, {
      action: 'startCapture',
      mode: 'video'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('メッセージ送信エラー:', chrome.runtime.lastError);
        showStatus('キャプチャを開始できませんでした。ページを更新してください。', 'error');
      } else {
        window.close();
      }
    });
  } catch (error) {
    console.error('動画キャプチャエラー:', error);
    showStatus('エラー: ' + error.message, 'error');
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}
