/** @odoo-module **/

import { registry } from "@web/core/registry";
import { MapController } from "@web_map/map_view/map_controller";
import { onMounted, onWillUnmount } from "@odoo/owl";

export class RefreshMapController extends MapController {
    setup() {
        super.setup();
        let interval;

        onMounted(() => {
            // Log to verify the controller is actually being used
            console.log("Auto-refresh Controller Mounted");

            interval = setInterval(async () => {
                // Check if the model and root exist to avoid errors during transitions
                if (this.model && this.model.root) {
                    console.log("Refreshing Map Data...");
                    
                    // .load() fetches data; .render() updates the screen
                    // Using .reload() is often more effective in newer versions
                    await this.model.root.load();
                    this.render(); 
                }
            }, 5000);
        });

        onWillUnmount(() => {
            if (interval) {
                clearInterval(interval);
            }
        });
    }
}

// Ensure we get the base map view definition properly
const mapView = registry.category("views").get("map");

registry.category("views").add("refresh_map_view", {
    ...mapView,
    Controller: RefreshMapController,
});