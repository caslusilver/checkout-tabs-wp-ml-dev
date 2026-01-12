(function () {
    'use strict';

    var report = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        isMobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
        isDesktop: !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
        hasGeolocation: 'geolocation' in navigator,
        hasPermissions: !!(navigator && navigator.permissions),
        modalOverlayExists: !!document.getElementById('ctwpml-geo-modal-overlay'),
        CTWPMLGeoExists: typeof window.CTWPMLGeo !== 'undefined',
        CTWPMLGeoParamsExists: typeof window.CTWPMLGeoParams !== 'undefined',
    };

    console.table(report);

    // Verificar estado da permissão
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
            .then(function (result) {
                console.log('[GEO DEBUG] Permission state:', result.state);
            })
            .catch(function (err) {
                console.log('[GEO DEBUG] Permission query error:', err);
            });
    }

    // Checar sessionStorage
    try {
        var promptShown = sessionStorage.getItem('ctwpml_geo_prompt_shown');
        var freteCache = sessionStorage.getItem('ctwpml_geo_freteData');
        console.log('[GEO DEBUG] Prompt já mostrado:', promptShown);
        console.log('[GEO DEBUG] Frete em cache:', !!freteCache);
    } catch (e) {
        console.log('[GEO DEBUG] SessionStorage error:', e);
    }
})();
