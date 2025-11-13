let canvas, ctx;
let originalImage = null;
let currentImage = null;
let mode = 'image';
let videoElement = null;
let generatedGif = null;

// トリミング用の変数
let videoCropRect = null;
let imageCropRect = null;
let isSelectingCrop = false;
let isSelectingImageCrop = false;
let cropStartX, cropStartY;

// 初期化
window.addEventListener('message', async (event) => {
  if (event.data.action === 'init') {
    mode = event.data.mode;
    
    if (mode === 'image') {
      await initImageMode(event.data.dataUrl, event.data.cropRect);
    } else {
      await initVideoMode(event.data.dataUrl);
    }
  }
});

// 画像モードの初期化
async function initImageMode(dataUrl, cropRect) {
  document.getElementById('imageControls').style.display = 'block';
  document.getElementById('videoControls').style.display = 'none';
  
  canvas = document.getElementById('editorCanvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  const img = new Image();
  img.onload = () => {
    // クロップ領域がある場合は切り取り
    if (cropRect && cropRect.width > 0 && cropRect.height > 0) {
      canvas.width = cropRect.width * window.devicePixelRatio;
      canvas.height = cropRect.height * window.devicePixelRatio;
      ctx.drawImage(
        img,
        cropRect.left * window.devicePixelRatio,
        cropRect.top * window.devicePixelRatio,
        cropRect.width * window.devicePixelRatio,
        cropRect.height * window.devicePixelRatio,
        0, 0,
        canvas.width,
        canvas.height
      );
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    }
    
    originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}

// 動画モードの初期化
async function initVideoMode(videoUrl) {
  document.getElementById('imageControls').style.display = 'none';
  document.getElementById('videoControls').style.display = 'block';
  document.getElementById('editorCanvas').style.display = 'none';
  
  videoElement = document.getElementById('videoPreview');
  videoElement.style.display = 'block';
  videoElement.src = videoUrl;
  
  videoElement.addEventListener('loadedmetadata', () => {
    document.getElementById('endTime').value = Math.min(3, videoElement.duration);
  });
}

// クロマキー処理
function applyChromakey(imageData, targetColor, sensitivity) {
  const data = imageData.data;
  const r = parseInt(targetColor.substr(1, 2), 16);
  const g = parseInt(targetColor.substr(3, 2), 16);
  const b = parseInt(targetColor.substr(5, 2), 16);
  
  for (let i = 0; i < data.length; i += 4) {
    const pixelR = data[i];
    const pixelG = data[i + 1];
    const pixelB = data[i + 2];
    
    // 色の距離を計算
    const distance = Math.sqrt(
      Math.pow(pixelR - r, 2) +
      Math.pow(pixelG - g, 2) +
      Math.pow(pixelB - b, 2)
    );
    
    // 感度に基づいて透明化
    if (distance < sensitivity * 2.5) {
      data[i + 3] = 0; // 完全に透明
    } else if (distance < sensitivity * 3) {
      // エッジをぼかす
      data[i + 3] = Math.floor(((distance - sensitivity * 2.5) / (sensitivity * 0.5)) * 255);
    }
  }
  
  return imageData;
}

// 画像を更新
function updateCanvas() {
  if (mode !== 'image' || !originalImage) return;

  // 元の画像をコピー
  currentImage = ctx.createImageData(originalImage);
  const tempData = new Uint8ClampedArray(originalImage.data);
  currentImage.data.set(tempData);

  // クロマキーが有効な場合は適用
  if (document.getElementById('chromakeyEnabled').checked) {
    const color = document.getElementById('chromakeyColor').value;
    const sensitivity = parseInt(document.getElementById('chromakeySensitivity').value);
    currentImage = applyChromakey(currentImage, color, sensitivity);
  }

  ctx.putImageData(currentImage, 0, 0);
}

// 画像トリミングを適用
function applyCrop() {
  if (!imageCropRect || !originalImage) return;

  // 選択範囲の画像データを取得
  const croppedImageData = ctx.getImageData(
    imageCropRect.x,
    imageCropRect.y,
    imageCropRect.width,
    imageCropRect.height
  );

  // キャンバスをトリミング後のサイズに変更
  canvas.width = imageCropRect.width;
  canvas.height = imageCropRect.height;

  // トリミングした画像を描画
  ctx.putImageData(croppedImageData, 0, 0);

  // トリミング後の画像を新しい元画像として保存
  originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
  currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

  imageCropRect = null;
  showStatus('トリミングを適用しました', 'success');
}

// イベントリスナー
document.getElementById('chromakeyEnabled').addEventListener('change', updateCanvas);
document.getElementById('chromakeyColor').addEventListener('input', updateCanvas);
document.getElementById('chromakeySensitivity').addEventListener('input', (e) => {
  document.getElementById('sensitivityValue').textContent = e.target.value;
  updateCanvas();
});

document.getElementById('fps').addEventListener('input', (e) => {
  document.getElementById('fpsValue').textContent = e.target.value;
});

document.getElementById('gifWidth').addEventListener('input', (e) => {
  document.getElementById('gifWidthValue').textContent = e.target.value;
});

document.getElementById('videoChromakeySensitivity').addEventListener('input', (e) => {
  document.getElementById('videoSensitivityValue').textContent = e.target.value;
});

// 画像トリミング機能
document.getElementById('cropBtn').addEventListener('click', () => {
  if (!canvas || mode !== 'image') return;

  isSelectingImageCrop = true;
  const canvasArea = document.getElementById('canvasArea');
  canvasArea.classList.add('selecting-crop');
  showStatus('キャンバス上でドラッグして範囲を選択してください', 'info');
});

document.getElementById('resetCropBtn').addEventListener('click', () => {
  if (!originalImage || mode !== 'image') return;

  // 元の画像に戻す
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  ctx.putImageData(originalImage, 0, 0);

  imageCropRect = null;
  const overlay = document.getElementById('cropOverlay');
  overlay.style.display = 'none';

  showStatus('元の画像に戻しました', 'success');
});

// 動画トリミング機能
document.getElementById('selectVideoCropArea').addEventListener('click', () => {
  if (!videoElement) return;

  isSelectingCrop = true;
  const canvasArea = document.getElementById('canvasArea');
  canvasArea.classList.add('selecting-crop');
  showStatus('動画上でドラッグして範囲を選択してください', 'info');
});

document.getElementById('resetVideoCrop').addEventListener('click', () => {
  videoCropRect = null;
  const overlay = document.getElementById('cropOverlay');
  overlay.style.display = 'none';
  document.getElementById('cropInfo').style.display = 'none';
  document.getElementById('videoCropEnabled').checked = false;
  showStatus('トリミング範囲をリセットしました', 'success');
});

// キャンバスエリアでのクロップ範囲選択（画像と動画の両方に対応）
const canvasArea = document.getElementById('canvasArea');

canvasArea.addEventListener('mousedown', (e) => {
  // 画像トリミングモード
  if (isSelectingImageCrop && mode === 'image') {
    const canvasElement = document.getElementById('editorCanvas');
    if (!canvasElement || canvasElement.style.display === 'none') return;

    const canvasRect = canvasElement.getBoundingClientRect();
    const canvasAreaRect = canvasArea.getBoundingClientRect();

    // canvas-area内での相対位置
    const relativeX = e.clientX - canvasAreaRect.left;
    const relativeY = e.clientY - canvasAreaRect.top;

    // キャンバス要素の範囲内かチェック
    const canvasLeft = canvasRect.left - canvasAreaRect.left;
    const canvasTop = canvasRect.top - canvasAreaRect.top;
    const canvasRight = canvasLeft + canvasRect.width;
    const canvasBottom = canvasTop + canvasRect.height;

    if (relativeX < canvasLeft || relativeX > canvasRight ||
        relativeY < canvasTop || relativeY > canvasBottom) {
      return;
    }

    cropStartX = relativeX;
    cropStartY = relativeY;

    const overlay = document.getElementById('cropOverlay');
    overlay.style.left = relativeX + 'px';
    overlay.style.top = relativeY + 'px';
    overlay.style.width = '0px';
    overlay.style.height = '0px';
    overlay.style.display = 'block';

    const onMouseMove = (e) => {
      const currentX = e.clientX - canvasAreaRect.left;
      const currentY = e.clientY - canvasAreaRect.top;

      const width = Math.abs(currentX - cropStartX);
      const height = Math.abs(currentY - cropStartY);
      const left = Math.min(currentX, cropStartX);
      const top = Math.min(currentY, cropStartY);

      overlay.style.left = left + 'px';
      overlay.style.top = top + 'px';
      overlay.style.width = width + 'px';
      overlay.style.height = height + 'px';
    };

    const onMouseUp = (e) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const currentX = e.clientX - canvasAreaRect.left;
      const currentY = e.clientY - canvasAreaRect.top;

      const width = Math.abs(currentX - cropStartX);
      const height = Math.abs(currentY - cropStartY);
      const left = Math.min(currentX, cropStartX);
      const top = Math.min(currentY, cropStartY);

      if (width > 20 && height > 20) {
        // オーバーレイの位置からキャンバス内の実際の座標に変換
        const overlayToCanvasX = left - canvasLeft;
        const overlayToCanvasY = top - canvasTop;

        // キャンバスの表示サイズに対する実際のキャンバスサイズの比率
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;

        imageCropRect = {
          x: overlayToCanvasX * scaleX,
          y: overlayToCanvasY * scaleY,
          width: width * scaleX,
          height: height * scaleY
        };

        // トリミングを実行
        applyCrop();
        overlay.style.display = 'none';
      } else {
        overlay.style.display = 'none';
        showStatus('範囲が小さすぎます。もう一度選択してください', 'error');
      }

      isSelectingImageCrop = false;
      canvasArea.classList.remove('selecting-crop');
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return;
  }

  // 動画トリミングモード
  if (!isSelectingCrop) return;

  // 動画要素を取得
  const video = document.getElementById('videoPreview');
  if (!video || video.style.display === 'none') return;

  const videoRect = video.getBoundingClientRect();
  const canvasAreaRect = canvasArea.getBoundingClientRect();

  // canvas-area内での相対位置
  const relativeX = e.clientX - canvasAreaRect.left;
  const relativeY = e.clientY - canvasAreaRect.top;

  // 動画要素の範囲内かチェック
  const videoLeft = videoRect.left - canvasAreaRect.left;
  const videoTop = videoRect.top - canvasAreaRect.top;
  const videoRight = videoLeft + videoRect.width;
  const videoBottom = videoTop + videoRect.height;

  if (relativeX < videoLeft || relativeX > videoRight ||
      relativeY < videoTop || relativeY > videoBottom) {
    return; // 動画外をクリックした場合は無視
  }

  cropStartX = relativeX;
  cropStartY = relativeY;

  const overlay = document.getElementById('cropOverlay');
  overlay.style.left = relativeX + 'px';
  overlay.style.top = relativeY + 'px';
  overlay.style.width = '0px';
  overlay.style.height = '0px';
  overlay.style.display = 'block';

  const onMouseMove = (e) => {
    const currentX = e.clientX - canvasAreaRect.left;
    const currentY = e.clientY - canvasAreaRect.top;

    const width = Math.abs(currentX - cropStartX);
    const height = Math.abs(currentY - cropStartY);
    const left = Math.min(currentX, cropStartX);
    const top = Math.min(currentY, cropStartY);

    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.width = width + 'px';
    overlay.style.height = height + 'px';
  };

  const onMouseUp = (e) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    const currentX = e.clientX - canvasAreaRect.left;
    const currentY = e.clientY - canvasAreaRect.top;

    const width = Math.abs(currentX - cropStartX);
    const height = Math.abs(currentY - cropStartY);
    const left = Math.min(currentX, cropStartX);
    const top = Math.min(currentY, cropStartY);

    if (width > 20 && height > 20) {
      // オーバーレイの位置から動画内の実際の座標に変換
      const overlayToVideoX = left - videoLeft;
      const overlayToVideoY = top - videoTop;

      // 動画の表示サイズに対する実際のビデオサイズの比率
      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;

      videoCropRect = {
        x: overlayToVideoX * scaleX,
        y: overlayToVideoY * scaleY,
        width: width * scaleX,
        height: height * scaleY
      };

      document.getElementById('videoCropEnabled').checked = true;
      document.getElementById('cropInfo').style.display = 'block';
      document.getElementById('cropDimensions').textContent =
        `${Math.round(videoCropRect.width)}x${Math.round(videoCropRect.height)}`;

      showStatus('トリミング範囲を設定しました', 'success');
    } else {
      overlay.style.display = 'none';
      showStatus('範囲が小さすぎます。もう一度選択してください', 'error');
    }

    isSelectingCrop = false;
    canvasArea.classList.remove('selecting-crop');
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

// GIF生成
document.getElementById('generateGif').addEventListener('click', async () => {
  if (!videoElement) return;
  
  showStatus('GIFを生成中...', 'info');
  
  try {
    const startTime = parseFloat(document.getElementById('startTime').value);
    const endTime = parseFloat(document.getElementById('endTime').value);
    const fps = parseInt(document.getElementById('fps').value);
    const width = parseInt(document.getElementById('gifWidth').value);
    
    const gif = await generateGif(videoElement, startTime, endTime, fps, width);
    
    // GIFプレビューを表示
    const preview = document.getElementById('gifPreview');
    const img = document.getElementById('gifImage');
    img.src = URL.createObjectURL(gif);
    preview.style.display = 'block';
    
    generatedGif = gif;
    
    showStatus('GIFの生成が完了しました！', 'success');
  } catch (error) {
    console.error('GIF生成エラー:', error);
    showStatus('GIFの生成に失敗しました', 'error');
  }
});

// 動画からGIFを生成
async function generateGif(video, startTime, endTime, fps, width) {
  const duration = endTime - startTime;
  const frameCount = Math.floor(duration * fps);
  const interval = 1 / fps;

  // トリミング設定を確認
  const cropEnabled = document.getElementById('videoCropEnabled').checked;
  const useCrop = cropEnabled && videoCropRect;

  // クロマキー設定を確認
  const chromakeyEnabled = document.getElementById('videoChromakeyEnabled').checked;
  const chromakeyColor = document.getElementById('videoChromakeyColor').value;
  const chromakeySensitivity = parseInt(document.getElementById('videoChromakeySensitivity').value);

  // Canvasを作成
  const tempCanvas = document.createElement('canvas');

  // トリミングがある場合は、トリミング領域のアスペクト比を使用
  let sourceWidth, sourceHeight, sourceX, sourceY;
  if (useCrop) {
    sourceX = videoCropRect.x;
    sourceY = videoCropRect.y;
    sourceWidth = videoCropRect.width;
    sourceHeight = videoCropRect.height;
  } else {
    sourceX = 0;
    sourceY = 0;
    sourceWidth = video.videoWidth;
    sourceHeight = video.videoHeight;
  }

  const aspectRatio = sourceHeight / sourceWidth;
  tempCanvas.width = width;
  tempCanvas.height = Math.floor(width * aspectRatio);
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  const frames = [];

  // フレームをキャプチャ
  for (let i = 0; i < frameCount; i++) {
    const time = startTime + (i * interval);
    video.currentTime = time;

    await new Promise(resolve => {
      video.addEventListener('seeked', resolve, { once: true });
    });

    // トリミング領域を描画
    if (useCrop) {
      tempCtx.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, tempCanvas.width, tempCanvas.height
      );
    } else {
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    // クロマキー処理を適用
    if (chromakeyEnabled) {
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const processedData = applyChromakey(imageData, chromakeyColor, chromakeySensitivity);
      tempCtx.putImageData(processedData, 0, 0);
    }

    frames.push(tempCanvas.toDataURL('image/png'));
  }

  // GIFエンコーディング（簡易版 - 実際はgif.jsなどのライブラリを使用）
  // ここでは連結PNGをGIFとして扱う簡易実装
  const blob = await createSimpleGif(frames, 1000 / fps);
  return blob;
}

// GIF作成（gif.jsライブラリを使用）
async function createSimpleGif(frames, delay) {
  return new Promise((resolve, reject) => {
    // gif.jsインスタンスを作成
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: chrome.runtime.getURL('gif.worker.js')
    });

    // 各フレームを追加
    let loadedFrames = 0;
    const totalFrames = frames.length;

    frames.forEach((frameDataUrl, index) => {
      const img = new Image();
      img.onload = () => {
        gif.addFrame(img, { delay: delay });
        loadedFrames++;

        // 進捗状況を表示
        const progress = Math.round((loadedFrames / totalFrames) * 50);
        showStatus(`フレームを読み込み中... (${loadedFrames}/${totalFrames})`, 'info');

        // 全フレーム読み込み完了後にレンダリング開始
        if (loadedFrames === totalFrames) {
          showStatus('GIFをエンコード中...', 'info');
          gif.render();
        }
      };
      img.onerror = () => {
        reject(new Error(`フレーム${index}の読み込みに失敗しました`));
      };
      img.src = frameDataUrl;
    });

    // エンコード進捗
    gif.on('progress', (progress) => {
      const percent = Math.round(progress * 100);
      showStatus(`GIFをエンコード中... ${percent}%`, 'info');
    });

    // レンダリング完了時
    gif.on('finished', (blob) => {
      resolve(blob);
    });

    // エラー時
    gif.on('error', (error) => {
      reject(error);
    });
  });
}

// ダウンロード
document.getElementById('downloadBtn').addEventListener('click', async () => {
  try {
    let blob;
    let filename;

    // タイムスタンプを生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    if (mode === 'image') {
      // 画像は128x128の正方形に固定（Slackの推奨サイズ）
      const size = 128;
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = size;
      resizedCanvas.height = size;
      const resizedCtx = resizedCanvas.getContext('2d');

      // アスペクト比を保持して中央配置
      const sourceAspect = canvas.width / canvas.height;
      let drawWidth, drawHeight, drawX, drawY;

      if (sourceAspect > 1) {
        // 横長の場合
        drawWidth = size;
        drawHeight = size / sourceAspect;
        drawX = 0;
        drawY = (size - drawHeight) / 2;
      } else {
        // 縦長の場合
        drawHeight = size;
        drawWidth = size * sourceAspect;
        drawX = (size - drawWidth) / 2;
        drawY = 0;
      }

      // 背景を透明に
      resizedCtx.clearRect(0, 0, size, size);
      resizedCtx.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);

      // 画像を128KB以下に圧縮
      blob = await compressImage(resizedCanvas, 128);
      filename = `${timestamp}.png`;
    } else {
      if (!generatedGif) {
        showStatus('先にGIFを生成してください', 'error');
        return;
      }
      // GIFを128KB以下に圧縮
      blob = await compressGif(generatedGif, 128);

      if (!blob) {
        showStatus('GIFを128KB以下に圧縮できませんでした。FPSを下げるか時間範囲を短くしてください。', 'error');
        return;
      }

      filename = `${timestamp}.gif`;
    }

    // Chrome Downloads APIを使用してファイルを保存
    const url = URL.createObjectURL(blob);
    try {
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true  // 保存先を毎回確認
      });

      if (mode === 'image') {
        showStatus('ダウンロードしました！', 'success');
      } else {
        const sizeInKB = (blob.size / 1024).toFixed(0);
        showStatus(`ダウンロードしました！ (${sizeInKB}KB)`, 'success');
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    showStatus('ダウンロードに失敗しました', 'error');
  }
});

// Slackにアップロード
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const emojiName = document.getElementById('emojiName').value.trim();
  
  if (!emojiName) {
    showStatus('絵文字名を入力してください', 'error');
    return;
  }
  
  if (!/^[a-z0-9_-]+$/.test(emojiName)) {
    showStatus('絵文字名は小文字、数字、アンダースコア、ハイフンのみ使用できます', 'error');
    return;
  }
  
  try {
    // 設定を取得
    const settings = await chrome.storage.sync.get(['workspace']);
    
    if (!settings.workspace) {
      showStatus('ワークスペース名を設定してください', 'error');
      return;
    }
    
    // まず画像をダウンロード
    let blob;
    let filename;

    if (mode === 'image') {
      // 画像は128x128の正方形に固定（Slackの推奨サイズ）
      const size = 128;
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = size;
      resizedCanvas.height = size;
      const resizedCtx = resizedCanvas.getContext('2d');

      // アスペクト比を保持して中央配置
      const sourceAspect = canvas.width / canvas.height;
      let drawWidth, drawHeight, drawX, drawY;

      if (sourceAspect > 1) {
        // 横長の場合
        drawWidth = size;
        drawHeight = size / sourceAspect;
        drawX = 0;
        drawY = (size - drawHeight) / 2;
      } else {
        // 縦長の場合
        drawHeight = size;
        drawWidth = size * sourceAspect;
        drawX = (size - drawWidth) / 2;
        drawY = 0;
      }

      // 背景を透明に
      resizedCtx.clearRect(0, 0, size, size);
      resizedCtx.drawImage(canvas, drawX, drawY, drawWidth, drawHeight);

      // 画像を128KB以下に圧縮
      blob = await compressImage(resizedCanvas, 128);
      filename = `${emojiName}.png`;
    } else {
      if (!generatedGif) {
        showStatus('先にGIFを生成してください', 'error');
        return;
      }
      // GIFを128KB以下に圧縮
      blob = await compressGif(generatedGif, 128);

      if (!blob) {
        showStatus('GIFを128KB以下に圧縮できませんでした。FPSを下げるか時間範囲を短くしてください。', 'error');
        return;
      }

      filename = `${emojiName}.gif`;
    }

    // Chrome Downloads APIを使用してファイルを保存
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true  // 保存先を毎回確認
      });

      // Slackの絵文字カスタマイズページを開く
      await chrome.runtime.sendMessage({
        action: 'openSlackCustomize',
        workspace: settings.workspace
      });

      if (mode === 'image') {
        showStatus(`「${filename}」をダウンロードしました！\nSlackのページで手動でアップロードしてください。`, 'success');
      } else {
        const sizeInKB = (blob.size / 1024).toFixed(0);
        showStatus(`「${filename}」(${sizeInKB}KB)をダウンロードしました！\nSlackのページで手動でアップロードしてください。`, 'success');
      }
    } finally {
      URL.revokeObjectURL(url);
    }
    
    // 5秒後に自動的に閉じる
    setTimeout(() => {
      window.parent.postMessage({ action: 'closeEditor' }, '*');
    }, 5000);
    
  } catch (error) {
    console.error('エラー:', error);
    showStatus('処理に失敗しました: ' + error.message, 'error');
  }
});

// 閉じる
document.getElementById('closeBtn').addEventListener('click', () => {
  window.parent.postMessage({ action: 'closeEditor' }, '*');
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;

  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
}

// 画像を指定サイズ(KB)以下に圧縮
async function compressImage(canvas, maxSizeKB) {
  let quality = 0.9;
  let blob;

  // PNG形式で試す
  blob = await new Promise(resolve => {
    canvas.toBlob(resolve, 'image/png');
  });

  // すでに128KB以下なら圧縮不要
  if (blob.size <= maxSizeKB * 1024) {
    return blob;
  }

  // JPEGに変換して圧縮を試みる
  while (quality > 0.1) {
    blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });

    if (blob.size <= maxSizeKB * 1024) {
      return blob;
    }

    quality -= 0.1;
  }

  // それでも大きければ画像サイズを縮小
  let scale = 0.9;
  while (scale > 0.3) {
    const tempCanvas = document.createElement('canvas');
    const newWidth = Math.floor(canvas.width * scale);
    const newHeight = Math.floor(canvas.height * scale);
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

    blob = await new Promise(resolve => {
      tempCanvas.toBlob(resolve, 'image/jpeg', 0.8);
    });

    if (blob.size <= maxSizeKB * 1024) {
      return blob;
    }

    scale -= 0.1;
  }

  // 最終手段として最小品質で返す
  return blob;
}

// GIFを指定サイズ(KB)以下に圧縮
async function compressGif(originalGif, maxSizeKB) {
  // すでに128KB以下なら圧縮不要
  if (originalGif.size <= maxSizeKB * 1024) {
    return originalGif;
  }

  // GIFは再生成が必要なので、元のフレームを削減して再生成する必要がある
  // ここでは簡易的に失敗を返す（ユーザーにFPS調整を促す）
  return null;
}
