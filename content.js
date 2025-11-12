let isSelecting = false;
let selectionDiv = null;
let startX, startY;
let captureMode = 'image';
let mediaRecorder = null;
let recordedChunks = [];

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startCapture') {
    captureMode = message.mode;
    if (captureMode === 'image') {
      startImageCapture();
      sendResponse({ success: true });
    } else {
      startVideoCapture();
      sendResponse({ success: true });
    }
    return true; // 非同期レスポンスを示す
  }
});

// 画像キャプチャの開始
function startImageCapture() {
  isSelecting = true;
  document.body.style.cursor = 'crosshair';
  
  // オーバーレイを作成
  const overlay = document.createElement('div');
  overlay.id = 'capture-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999999;
    cursor: crosshair;
  `;
  document.body.appendChild(overlay);
  
  // 選択範囲の矩形
  selectionDiv = document.createElement('div');
  selectionDiv.style.cssText = `
    position: fixed;
    border: 2px solid #611f69;
    background: rgba(97, 31, 105, 0.1);
    z-index: 1000000;
    pointer-events: none;
  `;
  document.body.appendChild(selectionDiv);
  
  overlay.addEventListener('mousedown', handleMouseDown);
  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseup', handleMouseUp);
  
  // ESCキーでキャンセル
  document.addEventListener('keydown', handleEscape);
}

function handleMouseDown(e) {
  startX = e.clientX;
  startY = e.clientY;
  selectionDiv.style.left = startX + 'px';
  selectionDiv.style.top = startY + 'px';
  selectionDiv.style.width = '0px';
  selectionDiv.style.height = '0px';
}

function handleMouseMove(e) {
  if (!startX) return;
  
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  const left = Math.min(currentX, startX);
  const top = Math.min(currentY, startY);
  
  selectionDiv.style.left = left + 'px';
  selectionDiv.style.top = top + 'px';
  selectionDiv.style.width = width + 'px';
  selectionDiv.style.height = height + 'px';
}

async function handleMouseUp(e) {
  const overlay = document.getElementById('capture-overlay');
  overlay.remove();
  
  const rect = selectionDiv.getBoundingClientRect();
  selectionDiv.remove();
  
  document.body.style.cursor = 'default';
  isSelecting = false;
  
  // 選択範囲をキャプチャ
  await captureSelectedArea(rect);
}

function handleEscape(e) {
  if (e.key === 'Escape' && isSelecting) {
    const overlay = document.getElementById('capture-overlay');
    if (overlay) overlay.remove();
    if (selectionDiv) selectionDiv.remove();
    document.body.style.cursor = 'default';
    isSelecting = false;
  }
}

async function captureSelectedArea(rect) {
  try {
    // タブ全体をキャプチャ
    const response = await chrome.runtime.sendMessage({
      action: 'captureTab'
    });

    if (response.error) {
      console.error('キャプチャエラー:', response.error);
      alert('キャプチャに失敗しました: ' + response.error);
      return;
    }

    if (!response.dataUrl) {
      console.error('データURLが取得できませんでした');
      alert('キャプチャに失敗しました: データが取得できませんでした');
      return;
    }

    // エディタを開く
    openEditor(response.dataUrl, rect, 'image');
  } catch (error) {
    console.error('キャプチャエラー:', error);
    alert('キャプチャに失敗しました: ' + error.message);
  }
}

// 動画キャプチャの開始
async function startVideoCapture() {
  try {
    // 画面キャプチャの許可を取得
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
        mediaSource: 'screen',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
    
    // 録画コントロールUIを表示
    showRecordingControls(stream);
    
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      
      // エディタを開く
      openEditor(videoUrl, null, 'video');
      
      // ストリームを停止
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
  } catch (error) {
    console.error('動画キャプチャエラー:', error);
    alert('動画キャプチャに失敗しました');
  }
}

function showRecordingControls(stream) {
  const controls = document.createElement('div');
  controls.id = 'recording-controls';
  controls.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  
  controls.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 12px; height: 12px; background: red; border-radius: 50%; animation: pulse 1s infinite;"></div>
      <span style="font-weight: 600;">録画中</span>
      <button id="stop-recording" style="
        padding: 8px 16px;
        background: #611f69;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      ">停止</button>
    </div>
  `;
  
  // パルスアニメーション
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(controls);
  
  document.getElementById('stop-recording').addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    controls.remove();
  });
  
  // ストリームが停止されたら自動的にコントロールを削除
  stream.getVideoTracks()[0].addEventListener('ended', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    controls.remove();
  });
}

function openEditor(dataUrl, cropRect, mode) {
  // エディタをiframeで開く
  const editorFrame = document.createElement('iframe');
  editorFrame.id = 'stamp-editor-frame';
  editorFrame.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    z-index: 2147483647;
    background: white;
  `;
  
  editorFrame.src = chrome.runtime.getURL('editor.html');
  document.body.appendChild(editorFrame);
  
  // エディタにデータを送信
  editorFrame.addEventListener('load', () => {
    editorFrame.contentWindow.postMessage({
      action: 'init',
      dataUrl: dataUrl,
      cropRect: cropRect,
      mode: mode
    }, '*');
  });
}

// エディタからのメッセージを受信
window.addEventListener('message', (event) => {
  if (event.data.action === 'closeEditor') {
    const frame = document.getElementById('stamp-editor-frame');
    if (frame) frame.remove();
  }
});
