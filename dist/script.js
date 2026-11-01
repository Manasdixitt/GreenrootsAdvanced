const GEOAPIFY_API_KEY = "6b4b353b3eb74bd191c7ae4751a7a86a";


document.addEventListener("DOMContentLoaded", function () {

    /* ==============================
       GET HTML ELEMENTS
    ============================== */

    const locationButton =
        document.querySelector(".location-button");

    const locationStatus =
        document.querySelector(".location-status");

    const manualLocation =
        document.querySelector(".manual-location");

    const locationMethod =
        document.querySelector(".location-method");

    const locationLat =
        document.querySelector(".location-lat");

    const locationLng =
        document.querySelector(".location-lng");

    const locationNameHidden =
        document.querySelector(".location-name-hidden");

    const locationSuggestions =
        document.querySelector(".location-suggestions");

    const mapElement =
        document.getElementById("map");


    /* ==============================
       SAFETY CHECK
    ============================== */

    if (
        !locationButton ||
        !locationStatus ||
        !manualLocation ||
        !locationMethod ||
        !locationSuggestions ||
        !mapElement ||
        !locationLat ||
        !locationLng ||
        !locationNameHidden
    ) {
        console.error("GreenRoots location elements not found.");
        return;
    }


    if (typeof L === "undefined") {
        console.error("Leaflet did not load.");
        return;
    }


    /* ==============================
       MAP
    ============================== */

    const map =
        L.map("map").setView(
            [26.4499, 80.3319],
            12
        );


    const tileUrl =
        `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;


    L.tileLayer(
        tileUrl,
        {
            maxZoom: 20,

            attribution:
                'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'
        }
    ).addTo(map);


    let mapMarker = null;


    /* ==============================
       GPS LOCATION
    ============================== */

    locationButton.addEventListener(
        "click",
        function () {

            locationButton.textContent =
                "📍 Detecting...";

            locationStatus.textContent =
                "Getting your location...";


            if (!navigator.geolocation) {

                locationStatus.textContent =
                    "❌ Location is not supported by this browser.";

                locationButton.textContent =
                    "📍 Try Again";

                return;
            }


            navigator.geolocation.getCurrentPosition(

                function (position) {

                    const latitude =
                        position.coords.latitude;

                    const longitude =
                        position.coords.longitude;


                    /* GPS is now the selected method */

                    locationMethod.value =
                        "gps";

                    locationLat.value = latitude;
                    locationLng.value = longitude;
                    locationNameHidden.value = "GPS Location";

                    /* Clear manual search */

                    manualLocation.value = "";

                    locationSuggestions.innerHTML =
                        "";


                    locationStatus.textContent =
                        "✅ Location detected successfully!";


                    locationButton.textContent =
                        "📍 Update My Location";


                    /* Move map */

                    map.setView(
                        [latitude, longitude],
                        16
                    );


                    /* Remove previous marker */

                    if (mapMarker) {

                        map.removeLayer(
                            mapMarker
                        );
                    }


                    /* Add GPS marker */

                    mapMarker =
                        L.marker(
                            [
                                latitude,
                                longitude
                            ]
                        ).addTo(map);


                    mapMarker
                        .bindPopup(
                            "📍 Your detected location"
                        )
                        .openPopup();


                    console.log(
                        "GPS Latitude:",
                        latitude
                    );

                    console.log(
                        "GPS Longitude:",
                        longitude
                    );

                },


                function (error) {

                    console.log(
                        "Location error:",
                        error
                    );


                    if (error.code === 1) {

                        locationStatus.textContent =
                            "❌ Location access was denied. Please allow location access and try again.";

                    }

                    else if (error.code === 2) {

                        locationStatus.textContent =
                            "❌ Your location could not be determined. Please try again.";

                    }

                    else if (error.code === 3) {

                        locationStatus.textContent =
                            "❌ Location request timed out. Please try again.";

                    }

                    else {

                        locationStatus.textContent =
                            "❌ Unable to get your location. Please try again.";
                    }


                    locationButton.textContent =
                        "📍 Try Again";
                }
            );
        }
    );


    /* ==============================
       MANUAL LOCATION SEARCH
    ============================== */

    let searchTimeout = null;

    let searchRequestNumber = 0;


    manualLocation.addEventListener(
        "input",
        function () {

            clearTimeout(searchTimeout);


            const query =
                manualLocation.value.trim();


            /* Clear old suggestions */

            locationSuggestions.innerHTML =
                "";


            /* If user starts typing,
               manual location becomes active */

            if (query.length > 0) {

                locationMethod.value =
                    "manual";

                locationStatus.textContent =
                    "🗺️ Searching for location...";
            }


            /* Need at least 3 characters */

            if (query.length < 3) {

                if (query.length === 0) {

                    locationMethod.value =
                        "";

                    locationStatus.textContent =
                        "Location not selected yet";
                }

                return;
            }


            searchTimeout =
                setTimeout(
                    async function () {

                        const currentRequest =
                            ++searchRequestNumber;


                        const url =
                            `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&limit=5&filter=countrycode:in&format=json&apiKey=${GEOAPIFY_API_KEY}`;


                        try {

                            const response =
                                await fetch(url);


                            if (!response.ok) {

                                throw new Error(
                                    "Geoapify request failed: " +
                                    response.status
                                );
                            }


                            const data =
                                await response.json();


                            /* Ignore old search results */

                            if (
                                currentRequest !==
                                searchRequestNumber
                            ) {
                                return;
                            }


                            locationSuggestions.innerHTML =
                                "";


                            /* No results */

                            if (
                                !data.results ||
                                data.results.length === 0
                            ) {

                                const noLocation =
                                    document.createElement("div");

                                noLocation.className =
                                    "no-location";

                                noLocation.textContent =
                                    "No locations found";

                                locationSuggestions.appendChild(
                                    noLocation
                                );

                                return;
                            }


                            /* Create suggestions */

                            data.results.forEach(
                                function (place) {

                                    const suggestion =
                                        document.createElement("div");


                                    suggestion.className =
                                        "location-suggestion";


                                    const icon =
                                        document.createElement("span");

                                    icon.className =
                                        "location-icon";

                                    icon.textContent =
                                        "📍";


                                    const text =
                                        document.createElement("span");

                                    text.textContent =
                                        place.formatted;


                                    suggestion.appendChild(
                                        icon
                                    );

                                    suggestion.appendChild(
                                        text
                                    );


                                    /* Click suggestion */

                                    suggestion.addEventListener(
                                        "click",
                                        function () {

                                            const latitude =
                                                Number(place.lat);

                                            const longitude =
                                                Number(place.lon);


                                            /* Put selected place
                                               in search box */

                                            manualLocation.value =
                                                place.formatted;


                                            /* Manual location selected */

                                            locationMethod.value =
                                                "manual";
                                            locationLat.value = latitude;
                                            locationLng.value = longitude;
                                            locationNameHidden.value = place.formatted;


                                            locationStatus.textContent =
                                                "🗺️ Location selected successfully!";


                                            /* Hide dropdown */

                                            locationSuggestions.innerHTML =
                                                "";


                                            /* Move map */

                                            map.setView(
                                                [
                                                    latitude,
                                                    longitude
                                                ],
                                                16
                                            );


                                            /* Remove old marker */

                                            if (mapMarker) {

                                                map.removeLayer(
                                                    mapMarker
                                                );
                                            }


                                            /* Create new marker */

                                            mapMarker =
                                                L.marker(
                                                    [
                                                        latitude,
                                                        longitude
                                                    ]
                                                ).addTo(map);


                                            mapMarker
                                                .bindPopup(
                                                    place.formatted
                                                )
                                                .openPopup();


                                            console.log(
                                                "Selected location:",
                                                place.formatted
                                            );

                                            console.log(
                                                "Latitude:",
                                                latitude
                                            );

                                            console.log(
                                                "Longitude:",
                                                longitude
                                            );
                                        }
                                    );


                                    locationSuggestions.appendChild(
                                        suggestion
                                    );
                                }
                            );

                        }

                        catch (error) {

                            console.error(
                                "Geoapify error:",
                                error
                            );


                            locationSuggestions.innerHTML =
                                "";


                            const errorMessage =
                                document.createElement("div");

                            errorMessage.className =
                                "no-location";

                            errorMessage.textContent =
                                "Unable to search locations";

                            locationSuggestions.appendChild(
                                errorMessage
                            );
                        }

                    },
                    150
                );
        }
    );

});