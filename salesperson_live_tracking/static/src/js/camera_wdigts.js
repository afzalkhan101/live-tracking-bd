

(function () {
    'use strict';

    /* ── Guard: only run on the live tracking page ── */
    if (!document.getElementById('openCameraBtn')) return;

    /* ══════════════════════════════════════════════
       DOM REFS
    ══════════════════════════════════════════════ */
    const $ = (id) => document.getElementById(id);

    const openBtn      = $('openCameraBtn');
    const video        = $('selfieVideo');
    const canvas       = $('selfieCanvas');
    const previewBox   = $('previewBox');
    const snapRow      = $('snapRow');
    const camLabel     = $('camLabel');
    const stopBtn      = $('stopBtn');
    const captureBtn   = $('captureBtn');
    const flipBtn      = $('flipBtn');
    const flashEl      = $('flashEl');
    const downloadLink = $('downloadLink');
    const camGallery   = $('camGallery');
    const galleryGrid  = $('galleryGrid');
    const galleryCount = $('galleryCount');
    const clearAllBtn  = $('clearAllBtn');
    const photoViewer  = $('photoViewer');
    const viewerImg    = $('viewerImg');
    const pvBack       = $('pvBack');
    const pvDownload   = $('pvDownload');
    const pvDelete     = $('pvDelete');

    let stream       = null;
    let facingMode   = 'environment';   
    let photos       = [];             
    let viewingIndex = -1;           



    /**
     * Request camera access and start streaming into the <video> element.
     * @param {string} facing - 'user' | 'environment'
     */
    async function startCamera(facing) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facing },
                    width:      { ideal: 1280 },
                    height:     { ideal: 960 },
                },
            });
            video.srcObject           = stream;
            video.style.display       = 'block';
            previewBox.style.display  = 'block';
            openBtn.style.display     = 'none';
            snapRow.style.display     = 'none';
            camGallery.style.display  = 'none';
            photoViewer.style.display = 'none';
            camLabel.textContent      = 'Tap the shutter button to take a photo';
        } catch (e) {
            camLabel.textContent = 'Camera access denied or unavailable.';
            console.error('Camera error:', e);
        }
    }

    function closeCamera() {
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
        video.style.display      = 'none';
        video.srcObject          = null;
        previewBox.style.display = 'none';
        openBtn.style.display    = 'inline-flex';
        camLabel.textContent     = 'Click to access your camera';
        snapRow.style.display    = 'none';
        if (photos.length > 0) renderGallery();
    }
    
    function renderGallery() {
        camGallery.style.display = 'flex';
        galleryCount.textContent = `Saved photos (${photos.length})`;
        galleryGrid.innerHTML    = '';

        if (photos.length === 0) {
            galleryGrid.innerHTML = '<div class="gallery-empty">No photos yet</div>';
            return;
        }

        photos.forEach(function (p, i) {
            const img = document.createElement('img');
            img.src   = p.dataUrl;
            img.title = p.ts;
            img.addEventListener('click', () => openViewer(i));
            galleryGrid.appendChild(img);
        });
    }


    /**
     * Open the full-screen viewer for a single photo.
     * @param {number} idx - index into photos[]
     */
    function openViewer(idx) {
        viewingIndex              = idx;
        viewerImg.src             = photos[idx].dataUrl;
        camGallery.style.display  = 'none';
        photoViewer.style.display = 'flex';
        openBtn.style.display     = 'none';
    }

    /* ══════════════════════════════════════════════
       CAPTURE & UPLOAD
    ══════════════════════════════════════════════ */

    /** Draw the current video frame to canvas, upload to Odoo, add to gallery. */
    function capturePhoto() {
        if (!stream) return;

        /* Flash effect */
        flashEl.classList.add('go');
        setTimeout(() => flashEl.classList.remove('go'), 160);

        /* Draw frame to hidden canvas */
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        /* Mirror front camera horizontally so selfies look natural */
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);

        const dataUrl  = canvas.toDataURL('image/jpeg', 0.92);
        const filename = `photo_${Date.now()}.jpg`;

        /* Add to local gallery */
        photos.push({ dataUrl, ts: new Date().toLocaleTimeString() });
        downloadLink.href     = dataUrl;
        downloadLink.download = filename;

        /* Upload to Odoo backend */
        fetch('/salesperson_tracking/save_photo', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method:  'call',
                id:      Date.now(),
                params:  { image_data: dataUrl, filename },
            }),
        })
        .then((res) => res.json())
        .then((data) => {
            const result = data.result;
            camLabel.textContent = result?.success
                ? '✓ Photo saved in Odoo!'
                : (result?.message || 'Upload failed');
            if (result?.success) snapRow.style.display = 'flex';
        })
        .catch((err) => {
            console.error('Photo upload error:', err);
            camLabel.textContent = 'Upload failed — network error';
        });

        /* Briefly show the snap confirmation row */
        snapRow.style.display = 'flex';
        setTimeout(() => { if (stream) snapRow.style.display = 'none'; }, 2000);

        renderGallery();
        camGallery.style.display = 'none';
    }
    

    /* ── Camera controls ── */
    openBtn.addEventListener('click',    () => startCamera(facingMode));
    stopBtn.addEventListener('click',    closeCamera);
    captureBtn.addEventListener('click', capturePhoto);

    flipBtn.addEventListener('click', () => {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        startCamera(facingMode);
    });

    /* ── Download link ── */
    downloadLink.addEventListener('click', (e) => {
        e.preventDefault();
        const a      = document.createElement('a');
        a.href       = downloadLink.href;
        a.download   = downloadLink.download;
        a.click();
    });

    /* ── Viewer controls ── */
    pvBack.addEventListener('click', () => {
        photoViewer.style.display = 'none';
        renderGallery();
        if (!stream) openBtn.style.display = 'inline-flex';
    });

    pvDownload.addEventListener('click', () => {
        const a    = document.createElement('a');
        a.href     = photos[viewingIndex].dataUrl;
        a.download = `photo_${Date.now()}.jpg`;
        a.click();
    });

    pvDelete.addEventListener('click', () => {
        photos.splice(viewingIndex, 1);
        photoViewer.style.display = 'none';
        if (photos.length > 0) renderGallery();
        else camGallery.style.display = 'none';
        if (!stream) openBtn.style.display = 'inline-flex';
    });

    /* ── Gallery ── */
    clearAllBtn.addEventListener('click', () => {
        photos = [];
        renderGallery();
    });

})();