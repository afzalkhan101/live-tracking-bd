(function () {
    'use strict';
    var mapEl = document.getElementById('map');
    if (!mapEl) return;
    var b64     = mapEl.getAttribute('data-points') || '';
    var planB64 = mapEl.getAttribute('data-plans')  || '';
    var points  = [];
    var plans   = [];

    try { points = JSON.parse(atob(b64));     } catch (e) { points = []; }
    try { plans  = JSON.parse(atob(planB64)); } catch (e) { plans  = []; }

    var DEFAULT_CENTER = [23.7701, 90.4254];
    var map = L.map('map', { zoomControl: true }).setView(DEFAULT_CENTER, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    /* ── No data at all ── */
    if (!points || points.length === 0) {
        document.getElementById('routeLoading').style.display = 'none';

        var nd = document.createElement('div');
        nd.className = 'no-data';
        nd.innerHTML = [
            '<div class="no-data-card">',
            '  <div class="no-data-icon">',
            '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>',
            '      <circle cx="12" cy="10" r="3"/>',
            '    </svg>',
            '  </div>',
            '  <div class="no-data-title">No location data</div>',
            '  <div class="no-data-sub">No GPS logs available for today.</div>',
            '</div>',
        ].join('');
        document.querySelector('.map-wrapper').appendChild(nd);
        return;
    }

    var valid = points.filter(function (p) {
        return typeof p.lat === 'number'
            && typeof p.lng === 'number'
            && (p.accuracy <= 200 || p.accuracy === 0);
    });
    if (valid.length === 0) valid = points;

    var latlngs = valid.map(function (p) { return [p.lat, p.lng]; });

    /* ══════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════ */

    function downsample(arr, maxPts) {
        if (arr.length <= maxPts) return arr;
        var step = arr.length / maxPts;
        var out  = [];
        for (var i = 0; i < arr.length; i += step) {
            out.push(arr[Math.floor(i)]);
        }
        var last = arr[arr.length - 1];
        if (out[out.length - 1] !== last) out.push(last);
        return out;
    }

    function addStartMarker(p) {
        return L.marker([p.lat, p.lng], {
            icon: L.divIcon({
                html: '<div style="width:16px;height:16px;background:#3b6d11;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',
                iconSize:   [16, 16],
                iconAnchor: [8, 8],
                className:  '',
            }),
        })
        .addTo(map)
        .bindPopup(
            '<b>Start point</b><br>' + (p.time || '') +
            (p.location_name ? '<br>' + p.location_name : '')
        );
    }

    function addEndMarker(p) {
        return L.marker([p.lat, p.lng], {
            icon: L.divIcon({
                html: '<div style="width:22px;height:22px;background:#dc2626;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.3)"></div>',
                iconSize:   [22, 22],
                iconAnchor: [11, 22],
                className:  '',
            }),
        })
        .addTo(map)
        .bindPopup(
            '<b>Current / last position</b><br>' + (p.time || '') +
            (p.location_name ? '<br>' + p.location_name : '') +
            '<br>Accuracy: ' + (p.accuracy ? p.accuracy.toFixed(1) + ' m' : '—')
        )
        .openPopup();
    }

    function addIntermediateMarkers(pts) {
        pts.forEach(function (p, i) {
            if (i === 0 || i === pts.length - 1) return;

            if (p.accuracy > 0 && p.accuracy <= 500) {
                L.circle([p.lat, p.lng], {
                    radius:      p.accuracy,
                    color:       '#3b82f6',
                    fillColor:   '#3b82f6',
                    fillOpacity: 0.08,
                    weight:      1,
                    opacity:     0.3,
                }).addTo(map);
            }

            var dot = L.circleMarker([p.lat, p.lng], {
                radius:      4,
                color:       '#1a73e8',
                fillColor:   '#bfdbfe',
                fillOpacity: 1,
                weight:      2,
            });

            var timeStr  = p.time  ? p.time.replace('T', ' ') : '—';
            var speedStr = p.speed ? (p.speed * 3.6).toFixed(1) + ' km/h' : '0 km/h';
            var accStr   = p.accuracy ? p.accuracy.toFixed(1) + ' m' : '—';

            dot.bindPopup(
                '<b>Time:</b> '     + timeStr  + '<br>' +
                '<b>Speed:</b> '    + speedStr + '<br>' +
                '<b>Accuracy:</b> ' + accStr   +
                (p.location_name ? '<br><b>Location:</b> ' + p.location_name : '')
            );
            dot.addTo(map);
        });
    }

    function addPlanMarkers(planList) {
        if (!planList || planList.length === 0) return;
        planList.forEach(function (pl) {
            if (typeof pl.lat !== 'number' || typeof pl.lng !== 'number') return;
            var visited = !!pl.visited;
            var color   = visited ? '#3b6d11' : '#dc2626';
            L.circleMarker([pl.lat, pl.lng], {
                radius:      7,
                color:       color,
                fillColor:   color,
                fillOpacity: visited ? 0.55 : 0.45,
                weight:      2,
            })
            .bindPopup(
                '<b>' + (pl.name || 'Planned location') + '</b><br>' +
                (visited ? '&#10003; Visited' : '&#8226; Not visited yet') +
                (pl.address ? '<br>' + pl.address : '')
            )
            .addTo(map);
        });
    }

    /* ══════════════════════════════════════════════
       MAP BOUNDS
    ══════════════════════════════════════════════ */

    function fitAll(routeBounds) {
        var allLatLngs = latlngs.slice();
        if (plans) {
            plans.forEach(function (pl) {
                if (typeof pl.lat === 'number') allLatLngs.push([pl.lat, pl.lng]);
            });
        }
        if (routeBounds) {
            map.fitBounds(routeBounds, { padding: [50, 50] });
        } else if (allLatLngs.length > 1) {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
        } else {
            map.setView(latlngs[0], 16);
        }
        setTimeout(function () { map.invalidateSize(); }, 300);
    }

    /* ══════════════════════════════════════════════
       ROUTE INFO CARD
    ══════════════════════════════════════════════ */

    function showRouteInfo(distKm, durMin) {
        var box = document.getElementById('routeInfoBox');
        var dp  = document.getElementById('routeDistancePill');
        var tp  = document.getElementById('routeDurationPill');
        var dv  = document.getElementById('routeDistVal');
        var tv  = document.getElementById('routeDurVal');

        document.getElementById('ribDur').textContent  = durMin + ' min';
        document.getElementById('ribDist').textContent = distKm + ' km';
        if (box) box.style.display = 'block';

        if (dp) { dp.style.display = 'flex'; dv.textContent = distKm + ' km'; }
        if (tp) { tp.style.display = 'flex'; tv.textContent = durMin + ' min'; }
    }

    /* ══════════════════════════════════════════════
       GPS FALLBACK POLYLINE
       Used when point count < 3 OR OSRM unavailable
    ══════════════════════════════════════════════ */

    function drawGpsFallback() {
        L.polyline(latlngs, {
            color:     '#6366f1',
            weight:    3,
            opacity:   0.85,
            dashArray: '7 5',
        }).addTo(map);
    }


    function finishRender(bounds) {
        addIntermediateMarkers(valid);
        addStartMarker(valid[0]);
        if (valid.length > 1) addEndMarker(valid[valid.length - 1]);
        addPlanMarkers(plans);
        fitAll(bounds || null);
    }

    var loadingEl = document.getElementById('routeLoading');

    if (valid.length < 3) {
        if (loadingEl) loadingEl.style.display = 'none';

        if (valid.length === 1) {

            addEndMarker(valid[0]);
            addPlanMarkers(plans);
            map.setView([valid[0].lat, valid[0].lng], 16);
            setTimeout(function () { map.invalidateSize(); }, 300);
        } else {
            drawGpsFallback();
            finishRender(null);
        }
        return;
    }

    function fetchRoadRoute(callback) {
        var sampled  = downsample(valid, 80);
        var coordStr = sampled.map(function (p) { return p.lng + ',' + p.lat; }).join(';');
        var url      = 'https://router.project-osrm.org/route/v1/driving/' + coordStr
                       + '?overview=full&geometries=geojson&steps=false';

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.routes && data.routes.length > 0) {
                    callback(null, data.routes[0]);
                } else {
                    callback(new Error('No route returned'), null);
                }
            })
            .catch(function (e) { callback(e, null); });
    }

    fetchRoadRoute(function (err, route) {
        if (loadingEl) loadingEl.style.display = 'none';

        if (!err && route) {
            var roadCoords = route.geometry.coordinates.map(function (c) {
                return [c[1], c[0]];
            });

            L.polyline(roadCoords, {
                color:   '#ffffff',
                weight:  11,
                opacity: 0.55,
            }).addTo(map);

            var roadLine = L.polyline(roadCoords, {
                color:   '#1a73e8',
                weight:  6,
                opacity: 0.9,
            }).addTo(map);

            var distKm = (route.distance / 1000).toFixed(1);
            var durMin = Math.round(route.duration / 60);
            showRouteInfo(distKm, durMin);

            finishRender(roadLine.getBounds());

        } else {
            console.warn('OSRM unavailable — using GPS fallback:', err);
            drawGpsFallback();
            finishRender(null);
        }
    });


     /* ══════════════════════════════════════════════
       CAMERA WIDGET
    ══════════════════════════════════════════════ */
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
     * Start the device camera with the given facing mode.
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
            video.srcObject        = stream;
            video.style.display    = 'block';
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
 
    /** Stop camera stream and restore the open-camera button. */
    function closeCamera() {
        if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
        video.style.display       = 'none';
        video.srcObject           = null;
        previewBox.style.display  = 'none';
        openBtn.style.display     = 'inline-flex';
        camLabel.textContent      = 'Click to access your camera';
        snapRow.style.display     = 'none';
        if (photos.length > 0) renderGallery();
    }
 
    /** Re-render the photo gallery grid. */
    function renderGallery() {
        camGallery.style.display = 'flex';
        galleryCount.textContent = `Saved photos (${photos.length})`;
        galleryGrid.innerHTML    = '';
 
        if (photos.length === 0) {
            galleryGrid.innerHTML = '<div class="gallery-empty">No photos yet</div>';
            return;
        }
 
        photos.forEach(function (p, i) {
            const img   = document.createElement('img');
            img.src     = p.dataUrl;
            img.title   = p.ts;
            img.addEventListener('click', () => openViewer(i));
            galleryGrid.appendChild(img);
        });
    }
 
    /** Open a single-photo viewer at the given index. */
    function openViewer(idx) {
        viewingIndex              = idx;
        viewerImg.src             = photos[idx].dataUrl;
        camGallery.style.display  = 'none';
        photoViewer.style.display = 'flex';
        openBtn.style.display     = 'none';
    }
 
    /* ── Camera button listeners ── */
    openBtn.addEventListener('click', () => startCamera(facingMode));
 
    stopBtn.addEventListener('click', closeCamera);
 
    flipBtn.addEventListener('click', () => {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        startCamera(facingMode);
    });
 
    captureBtn.addEventListener('click', () => {
        if (!stream) return;
 
        /* Flash effect */
        flashEl.classList.add('go');
        setTimeout(() => flashEl.classList.remove('go'), 160);
 
        /* Draw frame to canvas */
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(video, 0, 0);
 
        const dataUrl  = canvas.toDataURL('image/jpeg', 0.92);
        const filename = `photo_${Date.now()}.jpg`;
 
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
            console.error(err);
            camLabel.textContent = 'Upload failed — network error';
        });
 
        snapRow.style.display = 'flex';
        setTimeout(() => { if (stream) snapRow.style.display = 'none'; }, 2000);
 
        renderGallery();
        camGallery.style.display = 'none';
    });
 
    /* Save / download link */
    downloadLink.addEventListener('click', (e) => {
        e.preventDefault();
        const a      = document.createElement('a');
        a.href       = downloadLink.href;
        a.download   = downloadLink.download;
        a.click();
    });
 
    /* Viewer — back */
    pvBack.addEventListener('click', () => {
        photoViewer.style.display = 'none';
        renderGallery();
        if (!stream) openBtn.style.display = 'inline-flex';
    });
 
    /* Viewer — download */
    pvDownload.addEventListener('click', () => {
        const a      = document.createElement('a');
        a.href       = photos[viewingIndex].dataUrl;
        a.download   = `photo_${Date.now()}.jpg`;
        a.click();
    });
 
    /* Viewer — delete */
    pvDelete.addEventListener('click', () => {
        photos.splice(viewingIndex, 1);
        photoViewer.style.display = 'none';
        if (photos.length > 0) renderGallery();
        else camGallery.style.display = 'none';
        if (!stream) openBtn.style.display = 'inline-flex';
    });
 
    /* Clear all photos */
    clearAllBtn.addEventListener('click', () => {
        photos = [];
        renderGallery();
    });

    

})();


