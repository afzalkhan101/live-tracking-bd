{
    "name": "Salesperson Live Tracking",
    "summary": "Full salesperson field tracking: GPS, check-in/out, selfie proof, KPI, alerts, offline sync, CRM integration",
    "version": "19.0.2.0.0",
    "category": "Sales/Sales",
    "depends": ["sale_management", "web_map", "base_geolocalize", "crm", "mail"],
    "data": [
        "security/ir.model.access.csv",
        "security/ir.rule.xml",
        "views/salesperson_tracking_views.xml",
        "views/salesperson_visit_plan_views.xml",
        "views/salesperson_checkin_views.xml",
        "views/salesperson_kpi_views.xml",
        "views/res_users_views.xml",
        "views/templates.xml",
        "data/mail_template_data.xml",
    ],
    "assets": {
        # Backend assets (Odoo web client — menus, list/form views, etc.)
        "web.assets_backend": [
            "salesperson_live_tracking/static/src/scss/style.css",
            "salesperson_live_tracking/static/src/css/style.css",
        ],
        # Frontend assets (public portal pages — live tracking & moving map templates)
        "web.assets_frontend": [
            "salesperson_live_tracking/static/src/css/live_tracking.css",
            "salesperson_live_tracking/static/src/css/moving_map.css",
            "salesperson_live_tracking/static/src/js/live_tracking.js",
            "salesperson_live_tracking/static/src/js/moving_map.js",
        ],
    },
    "application": False,
    "license": "LGPL-3",
}