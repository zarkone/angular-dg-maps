/*!
 * Angular-dg-maps.js
 * http://burivuhster.github.io/angular-dg-maps
 *
 * Copyright 2013 Eugene Molodkin <burivuh@gmail.com>
 * Released under the MIT license
 * https://github.com/burivuhster/angular-dg-maps/blob/master/LICENSE
 */

(function() {
    'use strict';

    var dgMapsModule = angular.module("dg-maps", []);

    dgMapsModule.directive("dgMap", ["$log", "$timeout", "$filter", "$rootScope", function($log, $timeout, $filter, $rootScope) {

        return {
            restrict: "ECA",
            priority: 100,
            transclude: true,
            template: "<div class='angular-dg-map' ng-transclude></div>",
            replace: true,
            scope: {
                latitude: "=", // required
                longitude: "=", // required
                zoom: "=", // required
                markers: "=", // optional
                zoomControls: "=",
                fullscreenControls: "=",
                fitToMarkers: "=",
                draggable: "=",
                geoclicker: "="
            },
            link: function(scope, element, attrs, ctrl) {

                if (!angular.isDefined(scope.zoom)) {
                    $log.error("angular-dg-maps: map zoom property not set");
                    return;
                }

                angular.element(element).addClass("angular-dg-map");

                // Create DG Map object
                var _m = new DG.Map(element.attr('id'));

                // Set map center and zoom
                if (angular.isDefined(scope.latitude) && angular.isDefined(scope.longitude)) {
                    _m.setCenter(new DG.GeoPoint(scope.longitude, scope.latitude), scope.zoom);
                }

                // Add zoom controls
                var _zoom = new DG.Controls.Zoom();
                _m.controls.add(_zoom);

                var dragging = false;

                if (!angular.isDefined(scope.zoomControls) || scope.zoomControls) {
                    _zoom.show();
                } else {
                    _zoom.hide();
                }

                if (!angular.isDefined(scope.fullscreenControls) || scope.fullscreenControls) {
                    _m.fullscreen.enable();
                } else {
                    _m.fullscreen.disable();
                }

                if(angular.isDefined(scope.draggable) && !scope.draggable) {
                    _m.disableDragging();
                }

                if(angular.isDefined(scope.geoclicker) && !scope.geoclicker) {
                    _m.geoclicker.disable();
                }

                // Add marker utility function
                scope.addMarker = function(markerConfig) {
                    if (markerConfig.latitude && markerConfig.longitude) {
                        var markerDGConfig = {
                            geoPoint: new DG.GeoPoint(markerConfig.longitude, markerConfig.latitude),
                            draggable: !!markerConfig.draggable,
                            hint: markerConfig.hint || ""
                        };

                        if (markerConfig.click && typeof markerConfig.click === "function") {
                            markerDGConfig.clickCallback = markerConfig.click;
                        }

                        if (markerConfig.dragStart && typeof markerConfig.dragStart === "function") {
                            markerDGConfig.dragStartCallback = markerConfig.dragStart;
                        }

                        if (markerConfig.draggable) {
                            markerDGConfig.dragStopCallback = function(evt) {
                                var pos = evt.getPosition();
                                if(pos) {
                                    scope.$apply(function() {
                                        markerConfig.latitude = pos.lat;
                                        markerConfig.longitude = pos.lon;
                                    });
                                }

                                if (markerConfig.dragStop && typeof markerConfig.dragStop === "function") {
                                    markerConfig.dragStop.apply(this, arguments);
                                }
                            };
                        }


                        var marker = new DG.Markers.Common(markerDGConfig);

                        _m.markers.add(marker);
                    }
                };

                // Create markers
                if (angular.isDefined(scope.markers) && angular.isArray(scope.markers) && scope.markers.length) {
                    angular.forEach(scope.markers, function(markerConfig) {
                        scope.addMarker(markerConfig);
                    });
                }

                // Put the map into the scope
                scope.map = _m;

                // Update map when center coordinates change
                scope.$watch("latitude", function(newValue, oldValue) {
                    if (newValue === oldValue || dragging) {
                        return;
                    }

                    _m.setCenter(new DG.GeoPoint(scope.longitude, newValue), scope.zoom);
                }, true);

                scope.$watch("longitude", function(newValue, oldValue) {
                    if (newValue === oldValue || dragging) {
                        return;
                    }

                    _m.setCenter(new DG.GeoPoint(newValue, scope.latitude), scope.zoom);
                }, true);

                // Update map zoom when it changes
                scope.$watch("zoom", function(newValue, oldValue) {
                    if (newValue === oldValue || dragging) {
                        return;
                    }

                    _m.setZoom(newValue);
                }, true);

                // Update zoom controls visibility when model changes
                scope.$watch('zoomControls', function(newValue, oldValue) {
                    if (newValue == oldValue) {
                        return;
                    }

                    if (newValue) {
                        _zoom.show();
                    } else {
                        _zoom.hide();
                    }
                });

                // Update fulscreen control visibility when model changes
                scope.$watch('fullscreenControls', function(newValue, oldValue) {
                    if (newValue == oldValue) {
                        return;
                    }

                    if (newValue) {
                        _m.fullscreen.enable();
                    } else {
                        _m.fullscreen.disable();
                    }
                });

                scope.$watch('markers', function(markers) {
                    if(dragging) {
                        return;
                    }

                    if(markers) {
                        _m.markers.removeAll();
                        angular.forEach(scope.markers, function(markerConfig) {
                            scope.addMarker(markerConfig);
                        });

                        if(scope.fitToMarkers) {
                            var markersBounds = _m.markers.getBounds();
                            _m.setBounds(markersBounds);
                        }
                    }
                }, true);

                // Update model properties on map events
                _m.addEventListener(_m.getContainerId(), 'DgZoomChange', function(evt) {
                    if (!$rootScope.$root.$$phase) {
                        scope.$apply(function() {
                            scope.zoom = evt.getZoom();
                        });
                    } else {
                        scope.zoom = evt.getZoom();
                    }
                });

                _m.addEventListener(_m.getContainerId(), 'DgMapMove', function(evt) {
                    var pos = evt.getCenter();
                    if(pos) {
                        if (!$rootScope.$root.$$phase) {
                            scope.$apply(function() {
                                scope.latitude = pos.lat;
                                scope.longitude = pos.lon;
                            });
                        } else {
                            scope.latitude = pos.lat;
                            scope.longitude = pos.lon;
                        }
                    }
                });

                _m.addEventListener(_m.getContainerId(), 'DgDragStart', function() {
                    dragging = true;
                });

                _m.addEventListener(_m.getContainerId(), 'DgDragStop', function() {
                    dragging = false;
                });
            }
        };

    }]);

    dgMapsModule.directive('dgStaticMap', ['$log', function($log) {
        return {
            restrict: "ECA",
            priority: 100,
            template: "<img class='angular-dg-static-map' ng-src='{{ mapSrc }}'>",
            replace: true,
            scope: {
                latitude: "=", // required
                longitude: "=", // required
                zoom: "=", // required
                width: "=", //required
                height: "=", // required
                markers: "=" // optional
            },
            link: function(scope, element, attrs, ctrl) {
                if(!angular.isDefined(scope.latitude)) {
                    $log.error("angular-dg-static-maps: map latitude property not set");
                    return;
                }

                if(!angular.isDefined(scope.longitude)) {
                    $log.error("angular-dg-static-maps: map longitude property not set");
                    return;
                }

                if(!angular.isDefined(scope.markers) && !angular.isDefined(scope.zoom)) {
                    $log.error("angular-dg-static-maps: map zoom property not set");
                    return;
                }

                if(!angular.isDefined(scope.width) || !angular.isDefined(scope.height)) {
                    $log.error("angular-dg-static-maps: width and height properties should be set");
                    return;
                }

                angular.element(element).addClass("angular-dg-static-map");

                var src = 'http://static.maps.api.2gis.ru/1.0?';
                src += 'center=' + scope.longitude + ',' + scope.latitude;
                src += '&zoom=' + scope.zoom;
                src += '&size=' + scope.width + ',' + scope.height;

                if(angular.isDefined(scope.markers) && angular.isArray(scope.markers)) {
                    var tmpMarkers = [];
                    angular.forEach(scope.markers, function(marker) {
                        if(angular.isArray(marker) && marker.length >=2) {
                            tmpMarkers.push(marker.join(','));
                        }
                    });

                    src += '&markers=' + tmpMarkers.join('~');
                }

                scope.mapSrc = src;
            }
        };
    }]);

    dgMapsModule.service('geocoder', function() {
        return {
            get: function(query, options) {
                return DG.Geocoder.get(query, options);
            }
        };
    });
})();