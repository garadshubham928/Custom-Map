import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { FaTruck, FaCar, FaBus, FaPlus, FaTimes, FaRoute, FaWalking, FaBicycle, FaMotorcycle } from "react-icons/fa";
import { GoArrowRight } from "react-icons/go";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon
const blueIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -30],
});

// Fly to position on select
function FlyToLocation({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 13);
  }, [position, map]);
  return null;
}

// Draw route with OSRM
function RouteLayer({ start, deliveryPoints, profile, setDistanceTime }) {
  const [route, setRoute] = useState(null);
  const map = useMap();
  const routeRef = useRef(null);

  useEffect(() => {
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
    }
    setRoute(null);
    setDistanceTime({ distance: null, duration: null });
    
    if (!start || deliveryPoints.length === 0) return;

    const fetchRoute = async () => {
      const coordsList = [start, ...deliveryPoints]
        .map((p) => `${p.lng},${p.lat}`)
        .join(";");

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${coordsList}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeCoords = data.routes[0].geometry.coordinates.map((c) => [
          c[1],
          c[0],
        ]);
        setRoute(routeCoords);
        
        const newRoute = L.polyline(routeCoords, { color: '#007bff', weight: 6, opacity: 0.8 }).addTo(map);
        routeRef.current = newRoute;
        
        const distance = data.routes[0].distance;
        const duration = data.routes[0].duration;
        setDistanceTime({ distance, duration });
        
        const bounds = newRoute.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    };
    fetchRoute();
  }, [start, deliveryPoints, profile, setDistanceTime, map]);

  return route ? <Polyline positions={route} color="#007bff" weight={6} opacity={0.8} /> : null;
}

// Helper function to format duration
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  let result = '';
  if (hours > 0) {
    result += `${hours} hr `;
  }
  result += `${minutes} min`;
  return result.trim();
};

const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

// Vehicle options with their display names
const vehicleOptions = [
    { value: 'driving-car', label: 'Car', icon: <FaCar /> },
    { value: 'driving-hgv', label: 'Truck', icon: <FaTruck /> },
    { value: 'cycling-regular', label: 'Bicycle (Reg)', icon: <FaBicycle /> },
    { value: 'cycling-road', label: 'Bicycle (Road)', icon: <FaBicycle /> },
    { value: 'cycling-mountain', label: 'Bicycle (MTB)', icon: <FaBicycle /> },
    { value: 'walking', label: 'Walking', icon: <FaWalking /> },
    { value: 'foot', label: 'Foot', icon: <FaWalking /> },
    { value: 'motorcycle', label: 'Motorcycle', icon: <FaMotorcycle /> },
    { value: 'bus', label: 'Bus', icon: <FaBus /> },
    { value: 'scooter', label: 'Scooter', icon: <FaMotorcycle /> },
];

export default function DeliveryMap() {
  const [startPoint, setStartPoint] = useState(null);
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [vehicle, setVehicle] = useState("driving-car");
  const [distanceTime, setDistanceTime] = useState({ distance: null, duration: null });
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Geocode an address to get coordinates
  const geocodeAddress = async (address) => {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${address}&limit=1`);
    const data = await response.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        name: data[0].display_name
      };
    }
    return null;
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const geoResult = await geocodeAddress(`${coords.lat},${coords.lng}`);
        const name = geoResult ? geoResult.name.split(',')[0] : 'Current Location';
        setStartPoint(coords);
        setStartAddress(name);
        setSelectedLocations([{name: name, id: 'start', address: name}]);
      });
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleSearch = async (query, type) => {
    if (query.length < 3) {
        if (type === "start") setStartSuggestions([]);
        else setEndSuggestions([]);
        return;
    }
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
    const data = await response.json();
    if (type === "start") setStartSuggestions(data);
    else setEndSuggestions(data);
  };

  const handleSuggestionClick = (suggestion, type) => {
    const coords = { lng: parseFloat(suggestion.lon), lat: parseFloat(suggestion.lat) };
    const name = suggestion.display_name.split(',')[0];
    if (type === "start") {
      setStartAddress(name);
      setStartPoint(coords);
      setSelectedLocations([{ name: name, id: 'start', address: suggestion.display_name }]);
      setStartSuggestions([]);
    } else {
      setEndAddress("");
      setDeliveryPoints((prev) => [...prev, coords]);
      setSelectedLocations((prev) => [...prev, { name: name, id: `stop-${Date.now()}`, address: suggestion.display_name }]);
      setEndSuggestions([]);
    }
  };

  const clearDeliveries = () => {
    setStartPoint(null);
    setDeliveryPoints([]);
    setStartAddress("");
    setEndAddress("");
    setDistanceTime({ distance: null, duration: null });
    setSelectedLocations([]);
  };

  return (
    <div style={styles.deliveryMapContainer}>
      {/* Navbar with controls */}
      <div style={styles.navbar}>
        <div style={styles.navbarSection}>
          <div style={styles.inputGroup}>
            <input
              type="text"
              value={startAddress}
              onChange={(e) => {
                setStartAddress(e.target.value);
                handleSearch(e.target.value, "start");
              }}
              placeholder="Starting point..."
              style={styles.input}
            />
            <button onClick={getCurrentLocation} style={styles.btnCurrentLocation}>
              Current Location
            </button>
            {startSuggestions.length > 0 && (
              <div style={styles.suggestionsDropdown}>
                {startSuggestions.map((s, i) => (
                  <div key={i} onClick={() => handleSuggestionClick(s, "start")} style={styles.suggestionItem}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.navbarSection}>
          <div style={styles.inputGroup}>
            <input
              type="text"
              value={endAddress}
              onChange={(e) => {
                setEndAddress(e.target.value);
                handleSearch(e.target.value, "end");
              }}
              placeholder="Add stop..."
              style={styles.input}
            />
            <button onClick={() => {
                if (endAddress) {
                    geocodeAddress(endAddress).then(result => {
                        if (result) {
                            setEndAddress('');
                            setDeliveryPoints((prev) => [...prev, { lat: result.lat, lng: result.lng }]);
                            setSelectedLocations((prev) => [...prev, { name: result.name.split(',')[0], id: `stop-${Date.now()}`, address: result.name }]);
                        }
                    });
                }
            }} style={styles.btnAddStop}>
                <FaPlus />
            </button>
            {endSuggestions.length > 0 && (
              <div style={styles.suggestionsDropdown}>
                {endSuggestions.map((s, i) => (
                  <div key={i} onClick={() => handleSuggestionClick(s, "end")} style={styles.suggestionItem}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={styles.navbarSection}>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            style={styles.vehicleDropdown}
          >
            {vehicleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <button onClick={clearDeliveries} style={styles.btnClearDeliveries}>
          Clear
        </button>
      </div>

      {/* Map and Info */}
      <div style={styles.mapAndInfoContainer}>
        <MapContainer
          center={startPoint || [20.5937, 78.9629]}
          zoom={5}
          style={styles.mapContainer}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {startPoint && (
            <>
              <Marker position={[startPoint.lat, startPoint.lng]} icon={blueIcon}>
                <Popup>Start: {startAddress}</Popup>
              </Marker>
              <FlyToLocation position={[startPoint.lat, startPoint.lng]} />
            </>
          )}

          {deliveryPoints.map((point, idx) => (
            <Marker key={idx} position={[point.lat, point.lng]} icon={blueIcon}>
              <Popup>Delivery {idx + 1}</Popup>
            </Marker>
          ))}

          {startPoint && deliveryPoints.length > 0 && (
            <RouteLayer start={startPoint} deliveryPoints={deliveryPoints} profile={vehicle} setDistanceTime={setDistanceTime} />
          )}
        </MapContainer>

        {/* All-in-One Route Info Card (bottom-right) */}
        {selectedLocations.length > 0 && (
          <div style={styles.routeInfoCard}>
            <div style={styles.cardHeader}>
                <FaRoute style={{ marginRight: '8px' }} />
                Route Details
            </div>
            
            {/* Selected Locations List */}
            <div style={styles.locationsListContainer}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#555' }}>Stops</h5>
                <ul style={styles.ul}>
                    {selectedLocations.map((loc, index) => (
                        <li key={loc.id} style={styles.locationItem}>
                            <span style={{ fontWeight: '600', color: '#333' }}>{index + 1}.</span> {loc.name}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Distance & Time */}
            {distanceTime.distance !== null && (
              <div style={styles.metricsContainer}>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Distance</span>
                  <span style={styles.metricValue}>{formatDistance(distanceTime.distance)}</span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Time</span>
                  <span style={styles.metricValue}>{formatDuration(distanceTime.duration)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline styles object
const styles = {
    deliveryMapContainer: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        position: "relative",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    navbar: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "12px",
        padding: "12px 20px",
        backgroundColor: "#fff",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.08)",
        zIndex: 1000,
        position: "relative",
    },
    navbarSection: {
        flex: 1,
        minWidth: "150px",
    },
    inputGroup: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    input: {
        flex: 1,
        padding: "10px 14px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        fontSize: "14px",
        transition: "border-color 0.2s, box-shadow 0.2s",
    },
    btnCurrentLocation: {
        padding: "10px 14px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
        transition: "background-color 0.2s",
        whiteSpace: "nowrap",
        backgroundColor: "#f0f4ff",
        color: "#007bff",
    },
    btnAddStop: {
        padding: "10px 14px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
        transition: "background-color 0.2s",
        whiteSpace: "nowrap",
        backgroundColor: "#28a745",
        color: "#fff",
    },
    btnClearDeliveries: {
        padding: "10px 14px",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
        transition: "background-color 0.2s",
        whiteSpace: "nowrap",
        backgroundColor: "#dc3545",
        color: "#fff",
    },
    suggestionsDropdown: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        maxHeight: "200px",
        overflowY: "auto",
        zIndex: 1001,
        marginTop: "4px",
    },
    suggestionItem: {
        padding: "10px 14px",
        cursor: "pointer",
        borderBottom: "1px solid #f0f0f0",
        fontSize: "14px",
    },
    vehicleDropdown: {
        padding: "10px 14px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        fontSize: "14px",
        cursor: "pointer",
        backgroundColor: "#fff",
    },
    mapAndInfoContainer: {
        flex: 1,
        position: "relative",
    },
    mapContainer: {
        height: "100%",
        width: "100%",
    },
    routeInfoCard: {
        position: "absolute",
        bottom: "20px",
        right: "20px",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
        zIndex: 900,
        width: "280px",
    },
    cardHeader: {
        fontSize: "16px",
        fontWeight: "600",
        marginBottom: "15px",
        paddingBottom: "10px",
        borderBottom: "1px solid #eee",
        display: "flex",
        alignItems: "center",
        color: "#333",
    },
    locationsListContainer: {
        marginBottom: "15px",
    },
    ul: {
        listStyle: "none",
        padding: 0,
        margin: 0,
    },
    locationItem: {
        padding: "5px 0",
        fontSize: "14px",
        color: "#555",
        borderBottom: "1px dashed #f0f0f0",
    },
    metricsContainer: {
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        paddingTop: "15px",
        borderTop: "1px solid #eee",
    },
    metricItem: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
    },
    metricLabel: {
        fontSize: "12px",
        color: "#888",
        textTransform: "uppercase",
        fontWeight: "500",
    },
    metricValue: {
        fontSize: "18px",
        fontWeight: "700",
        color: "#333",
    },
};












// import React, { useState, useRef, useEffect, useCallback } from 'react';
// import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
// import L from 'leaflet';
// import 'leaflet/dist/leaflet.css';
// import { FaLocationCrosshairs } from "react-icons/fa6";

// // Fix for default markers in React Leaflet
// delete L.Icon.Default.prototype._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
//   iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
//   shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
// });

// // Debounce hook
// const useDebounce = (value, delay) => {
//   const [debouncedValue, setDebouncedValue] = useState(value);
//   useEffect(() => {
//     const handler = setTimeout(() => {
//       setDebouncedValue(value);
//     }, delay);
//     return () => {
//       clearTimeout(handler);
//     };
//   }, [value, delay]);
//   return debouncedValue;
// };

// // Device detection hook
// const useDeviceType = () => {
//   const [deviceType, setDeviceType] = useState('desktop');
  
//   useEffect(() => {
//     const updateDeviceType = () => {
//       const width = window.innerWidth;
//       if (width < 768) {
//         setDeviceType('mobile');
//       } else if (width < 1024) {
//         setDeviceType('tablet');
//       } else {
//         setDeviceType('desktop');
//       }
//     };
    
//     updateDeviceType();
//     window.addEventListener('resize', updateDeviceType);
//     return () => window.removeEventListener('resize', updateDeviceType);
//   }, []);
  
//   return deviceType;
// };

// // Enhanced SearchInput Component with better mobile support
// const SearchInput = ({ value, onChange, placeholder, onLocationClick, suggestions, onSuggestionClick, isLoading, showLocationBtn = false, deviceType }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isFocused, setIsFocused] = useState(false);
//   const inputRef = useRef(null);
//   const suggestionRefs = useRef([]);

//   const isMobile = deviceType === 'mobile';
//   const isTablet = deviceType === 'tablet';

//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (inputRef.current && !inputRef.current.contains(event.target)) {
//         setIsOpen(false);
//         setIsFocused(false);
//       }
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     document.addEventListener('touchstart', handleClickOutside);
//     return () => {
//       document.removeEventListener('mousedown', handleClickOutside);
//       document.removeEventListener('touchstart', handleClickOutside);
//     };
//   }, []);

//   // Prevent zoom on iOS when focusing input
//   useEffect(() => {
//     if (isFocused && isMobile) {
//       const viewport = document.querySelector('meta[name=viewport]');
//       if (viewport) {
//         viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
//       }
//     }
    
//     return () => {
//       if (isMobile) {
//         const viewport = document.querySelector('meta[name=viewport]');
//         if (viewport) {
//           viewport.setAttribute('content', 'width=device-width, initial-scale=1');
//         }
//       }
//     };
//   }, [isFocused, isMobile]);

//   const inputStyles = {
//     flex: 1,
//     padding: isMobile ? '10px 12px' : isTablet ? '11px 14px' : '12px 16px',
//     fontSize: isMobile ? '14px' : '15px',
//     fontWeight: '500',
//     border: '1px solid transparent',
//     borderRadius: isMobile ? '8px' : '10px',
//     background: 'rgba(255,255,255,0.95)',
//     backdropFilter: 'blur(10px)',
//     color: '#1a1a1a',
//     transition: 'all 0.2s ease',
//     boxShadow: isFocused 
//       ? '0 4px 12px rgba(102,126,234,0.15)' 
//       : '0 2px 8px rgba(0,0,0,0.08)',
//     outline: 'none',
//     borderColor: isFocused ? '#667eea' : 'rgba(0,0,0,0.1)',
//     WebkitAppearance: 'none',
//     WebkitTapHighlightColor: 'transparent'
//   };

//   const buttonStyles = {
//     padding: isMobile ? '10px 12px' : isTablet ? '11px 14px' : '12px 16px',
//     background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//     border: 'none',
//     borderRadius: isMobile ? '8px' : '10px',
//     color: 'white',
//     fontSize: isMobile ? '12px' : '13px',
//     fontWeight: '600',
//     cursor: 'pointer',
//     transition: 'all 0.2s ease',
//     boxShadow: '0 4px 12px rgba(102,126,234,0.25)',
//     display: 'flex',
//     alignItems: 'center',
//     gap: '6px',
//     minWidth: isMobile ? '80px' : '90px',
//     justifyContent: 'center',
//     WebkitTapHighlightColor: 'transparent'
//   };

//   return (
//     <div className="search-container" ref={inputRef} style={{ position: 'relative', width: '100%' }}>
//       <div style={{ 
//         display: 'flex', 
//         gap: isMobile ? '6px' : '8px', 
//         width: '100%'
//       }}>
//         <input
//           ref={inputRef}
//           type="text"
//           value={value}
//           onChange={(e) => {
//             onChange(e.target.value);
//             setIsOpen(true);
//           }}
//           onFocus={() => {
//             setIsOpen(true);
//             setIsFocused(true);
//           }}
//           onBlur={() => {
//             setIsFocused(false);
//           }}
//           placeholder={placeholder}
//           style={inputStyles}
//           autoComplete="off"
//           autoCorrect="off"
//           autoCapitalize="off"
//           spellCheck="false"
//         />
        
//         {showLocationBtn && (
//           <button
//             onClick={onLocationClick}
//             disabled={isLoading}
//             style={buttonStyles}
//             onTouchStart={(e) => {
//               if (!isLoading) {
//                 e.target.style.transform = 'scale(0.95)';
//               }
//             }}
//             onTouchEnd={(e) => {
//               e.target.style.transform = 'scale(1)';
//             }}
//           >
//             {isLoading ? (
//               <>⏳</>
//             ) : (
//               <div style={{ backgroundColor: 'black', borderRadius: '50%', width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
//                 <FaLocationCrosshairs size={isMobile ? 12 : 14} />
//               </div>
//             )}
//           </button>
//         )}
//       </div>
      
//       {/* Compact Suggestions Dropdown */}
//       {isOpen && suggestions.length > 0 && (
//         <div style={{
//           position: 'absolute',
//           top: '100%',
//           left: 0,
//           right: 0,
//           zIndex: 1000,
//           background: 'rgba(255,255,255,0.98)',
//           backdropFilter: 'blur(20px)',
//           borderRadius: isMobile ? '12px' : '14px',
//           boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
//           marginTop: '4px',
//           overflow: 'hidden',
//           border: '1px solid rgba(0,0,0,0.08)',
//           maxHeight: isMobile ? '160px' : '200px',
//           overflowY: 'auto',
//           WebkitOverflowScrolling: 'touch'
//         }}>
//           {suggestions.map((suggestion, index) => (
//             <div
//               key={index}
//               ref={el => suggestionRefs.current[index] = el}
//               onClick={() => {
//                 onSuggestionClick(suggestion);
//                 setIsOpen(false);
//               }}
//               style={{
//                 padding: isMobile ? '8px 12px' : '10px 14px',
//                 cursor: 'pointer',
//                 borderBottom: index < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
//                 transition: 'background 0.2s ease',
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: '8px',
//                 fontSize: isMobile ? '13px' : '14px',
//                 fontWeight: '500',
//                 WebkitTapHighlightColor: 'transparent'
//               }}
//               onMouseEnter={(e) => {
//                 e.target.style.background = 'rgba(102,126,234,0.06)';
//               }}
//               onMouseLeave={(e) => {
//                 e.target.style.background = 'transparent';
//               }}
//             >
//               <div style={{
//                 width: '20px',
//                 height: '20px',
//                 borderRadius: '50%',
//                 background: 'linear-gradient(135deg, #667eea, #764ba2)',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 color: 'white',
//                 fontSize: '10px',
//                 flexShrink: 0
//               }}>
//                 📍
//               </div>
//               <div style={{ overflow: 'hidden', flex: 1 }}>
//                 <div style={{ 
//                   color: '#1a1a1a', 
//                   fontWeight: '600',
//                   whiteSpace: 'nowrap',
//                   overflow: 'hidden',
//                   textOverflow: 'ellipsis'
//                 }}>
//                   {suggestion.display_name ? suggestion.display_name.split(',')[0] : suggestion}
//                 </div>
//                 <div style={{ 
//                   color: '#666', 
//                   fontSize: isMobile ? '11px' : '12px', 
//                   marginTop: '1px',
//                   whiteSpace: 'nowrap',
//                   overflow: 'hidden',
//                   textOverflow: 'ellipsis'
//                 }}>
//                   {suggestion.display_name ? suggestion.display_name.split(',').slice(1, 2).join(',') : ''}
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };

// // Custom hook for routing
// const RouteLayer = ({ start, end, vehicleProfile, routeData, setRouteData }) => {
//   const map = useMap();

//   useEffect(() => {
//     if (!start || !end) return;

//     const fetchRoute = async () => {
//       try {
//         const profile = vehicleProfile === 'driving-hgv' ? 'driving' : 
//                        vehicleProfile === 'driving-car' ? 'driving' : 
//                        vehicleProfile === 'cycling-regular' ? 'cycling' : 'foot';
        
//         const response = await fetch(
//           `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
//         );

//         if (!response.ok) throw new Error('Failed to fetch route');

//         const data = await response.json();
        
//         const routeData = {
//           features: [{
//             geometry: data.routes[0].geometry,
//             properties: {
//               segments: [{
//                 distance: data.routes[0].distance,
//                 duration: data.routes[0].duration
//               }]
//             }
//           }]
//         };
        
//         setRouteData(routeData);

//         if (routeData.features && routeData.features[0]) {
//           const routeCoordinates = routeData.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          
//           map.eachLayer((layer) => {
//             if (layer instanceof L.Polyline && layer.options.className === 'route-line') {
//               map.removeLayer(layer);
//             }
//           });

//           const routeLine = L.polyline(routeCoordinates, {
//             color: '#667eea',
//             weight: 6,
//             opacity: 0.9,
//             className: 'route-line'
//           }).addTo(map);

//           map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
//         }
//       } catch (error) {
//         console.error('Error fetching route:', error);
//       }
//     };

//     fetchRoute();
//   }, [start, end, vehicleProfile, map, setRouteData]);

//   return null;
// };

// const App = () => {
//   const [startPoint, setStartPoint] = useState(null);
//   const [endPoint, setEndPoint] = useState(null);
//   const [startAddress, setStartAddress] = useState('');
//   const [endAddress, setEndAddress] = useState('');
//   const [vehicleProfile, setVehicleProfile] = useState('driving-hgv');
//   const [routeData, setRouteData] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [currentLocation, setCurrentLocation] = useState(null);
//   const [startSuggestions, setStartSuggestions] = useState([]);
//   const [endSuggestions, setEndSuggestions] = useState([]);
//   const [isControlsVisible, setIsControlsVisible] = useState(true);

//   const mapRef = useRef();
//   const deviceType = useDeviceType();
//   const debouncedStartAddress = useDebounce(startAddress, 300);
//   const debouncedEndAddress = useDebounce(endAddress, 300);

//   const isMobile = deviceType === 'mobile';
//   const isTablet = deviceType === 'tablet';

//   // Vehicle profiles
//   const vehicleProfiles = [
//     { value: 'driving-hgv', label: isMobile ? 'Truck' : 'Truck', icon: '🚛' },
//     { value: 'driving-car', label: 'Car', icon: '🚗' },
//     { value: 'cycling-regular', label: isMobile ? 'Bike' : 'Bicycle', icon: '🚲' },
//     { value: 'foot-walking', label: 'Walk', icon: '🚶' }
//   ];

//   // Fetch suggestions
//   const fetchSuggestions = useCallback(async (query) => {
//     if (!query.trim() || query.length < 3) return [];
    
//     try {
//       const response = await fetch(
//         `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
//       );
//       const data = await response.json();
//       return data || [];
//     } catch (error) {
//       console.error('Error fetching suggestions:', error);
//       return [];
//     }
//   }, []);

//   // Update suggestions when debounced values change
//   useEffect(() => {
//     if (debouncedStartAddress && debouncedStartAddress !== 'Current Location') {
//       fetchSuggestions(debouncedStartAddress).then(setStartSuggestions);
//     } else {
//       setStartSuggestions([]);
//     }
//   }, [debouncedStartAddress, fetchSuggestions]);

//   useEffect(() => {
//     if (debouncedEndAddress) {
//       fetchSuggestions(debouncedEndAddress).then(setEndSuggestions);
//     } else {
//       setEndSuggestions([]);
//     }
//   }, [debouncedEndAddress, fetchSuggestions]);

//   // Get current location
//   const getCurrentLocation = () => {
//     if (!navigator.geolocation) {
//       alert('Geolocation is not supported by this browser.');
//       return;
//     }

//     setIsLoading(true);
//     navigator.geolocation.getCurrentPosition(
//       (position) => {
//         const location = {
//           lat: position.coords.latitude,
//           lng: position.coords.longitude
//         };
//         setCurrentLocation(location);
//         setStartPoint(location);
//         setStartAddress('Current Location');
//         setIsLoading(false);
//       },
//       (error) => {
//         setIsLoading(false);
//         alert('Unable to get your location. Please enter address manually.');
//       },
//       { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
//     );
//   };

//   // Handle suggestion click
//   const handleSuggestionClick = (suggestion, type) => {
//     const coords = { lng: parseFloat(suggestion.lon), lat: parseFloat(suggestion.lat) };
//     const displayName = suggestion.display_name;
    
//     if (type === 'start') {
//       setStartAddress(displayName);
//       setStartPoint(coords);
//       setStartSuggestions([]);
//     } else {
//       setEndAddress(displayName);
//       setEndPoint(coords);
//       setEndSuggestions([]);
//     }
//   };

//   // Geocode address
//   const geocodeAddress = async (address) => {
//     if (!address.trim()) return null;
    
//     try {
//       const response = await fetch(
//         `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
//       );
//       const data = await response.json();
      
//       if (data && data.length > 0) {
//         return { lng: parseFloat(data[0].lon), lat: parseFloat(data[0].lat) };
//       }
//       return null;
//     } catch (error) {
//       console.error('Geocoding error:', error);
//       return null;
//     }
//   };

//   const handleFindRoute = async () => {
//     setIsLoading(true);
    
//     try {
//       let start, end;

//       if (currentLocation && startAddress === 'Current Location') {
//         start = currentLocation;
//       } else {
//         start = await geocodeAddress(startAddress);
//       }

//       end = await geocodeAddress(endAddress);

//       if (!start || !end) {
//         alert('Could not find one or both addresses. Please check and try again.');
//         setIsLoading(false);
//         return;
//       }

//       setStartPoint(start);
//       setEndPoint(end);
      
//       if (isMobile) {
//         setTimeout(() => setIsControlsVisible(false), 1000);
//       }
//     } catch (error) {
//       console.error('Error finding route:', error);
//       alert('Error finding addresses. Please try again.');
//     }
    
//     setIsLoading(false);
//   };

//   const formatDistance = (meters) => {
//     if (meters < 1000) return `${Math.round(meters)}m`;
//     return `${(meters / 1000).toFixed(1)}km`;
//   };

//   const formatDuration = (seconds) => {
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     if (hours > 0) return `${hours}h ${minutes}m`;
//     return `${minutes}m`;
//   };

//   return (
//     <>
//       <div style={{ 
//         height: '100vh', 
//         display: 'flex', 
//         flexDirection: 'column',
//         background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//         fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
//         overflow: 'hidden'
//       }}>
        
//         {/* Compact Controls - Significantly reduced spacing */}
//         <div style={{ 
//           background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08))',
//           backdropFilter: 'blur(20px)',
//           padding: isMobile ? '8px 12px' : isTablet ? '10px 16px' : '12px 20px', 
//           borderBottom: '1px solid rgba(255,255,255,0.1)',
//           display: 'grid',
//           gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr) 120px 80px' : 'repeat(2, 1fr) 140px 100px',
//           gap: isMobile ? '8px' : '12px',
//           alignItems: 'end',
//           transform: isMobile && !isControlsVisible ? 'translateY(-100%)' : 'translateY(0)',
//           transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
//           position: 'relative',
//           zIndex: 1000,
//           minHeight: 'auto' // Ensure minimum height for compact layout
//         }}>
          
//           {/* Mobile toggle button */}
//           {isMobile && (
//             <button
//               onClick={() => setIsControlsVisible(!isControlsVisible)}
//               style={{
//                 position: 'absolute',
//                 bottom: '-32px',
//                 left: '50%',
//                 transform: 'translateX(-50%)',
//                 background: 'rgba(0,0,0,0.7)',
//                 border: 'none',
//                 borderRadius: '16px',
//                 padding: '6px 12px',
//                 color: 'white',
//                 fontSize: '11px',
//                 fontWeight: '600',
//                 cursor: 'pointer',
//                 boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
//                 WebkitTapHighlightColor: 'transparent'
//               }}
//             >
//               {isControlsVisible ? '▼' : '▲'}
//             </button>
//           )}

//           {/* Compact form fields */}
//           <div>
//             <label style={{ 
//               display: 'block', 
//               marginBottom: '4px', 
//               fontWeight: '600',
//               fontSize: isMobile ? '12px' : '13px',
//               color: 'rgba(255,255,255,0.9)',
//               letterSpacing: '0.02em'
//             }}>
//               From
//             </label>
//             <SearchInput
//               value={startAddress}
//               onChange={setStartAddress}
//               placeholder="Starting point..."
//               onLocationClick={getCurrentLocation}
//               suggestions={startSuggestions}
//               onSuggestionClick={(suggestion) => handleSuggestionClick(suggestion, 'start')}
//               isLoading={isLoading}
//               showLocationBtn={true}
//               deviceType={deviceType}
//             />
//           </div>

//           <div>
//             <label style={{ 
//               display: 'block', 
//               marginBottom: '4px', 
//               fontWeight: '600',
//               fontSize: isMobile ? '12px' : '13px',
//               color: 'rgba(255,255,255,0.9)',
//               letterSpacing: '0.02em'
//             }}>
//               To
//             </label>
//             <SearchInput
//               value={endAddress}
//               onChange={setEndAddress}
//               placeholder="Destination..."
//               suggestions={endSuggestions}
//               onSuggestionClick={(suggestion) => handleSuggestionClick(suggestion, 'end')}
//               isLoading={false}
//               deviceType={deviceType}
//             />
//           </div>

//           <div>
//             <label style={{ 
//               display: 'block', 
//               marginBottom: '4px', 
//               fontWeight: '600',
//               fontSize: isMobile ? '12px' : '13px',
//               color: 'rgba(255,255,255,0.9)',
//               letterSpacing: '0.02em'
//             }}>
//               Vehicle
//             </label>
//             <select
//               value={vehicleProfile}
//               onChange={(e) => setVehicleProfile(e.target.value)}
//               style={{
//                 width: '100%',
//                 padding: isMobile ? '10px 12px' : isTablet ? '11px 14px' : '12px 16px',
//                 fontSize: isMobile ? '14px' : '15px',
//                 fontWeight: '500',
//                 border: '1px solid rgba(0,0,0,0.1)',
//                 borderRadius: isMobile ? '8px' : '10px',
//                 background: 'rgba(255,255,255,0.95)',
//                 backdropFilter: 'blur(10px)',
//                 color: '#1a1a1a',
//                 boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
//                 outline: 'none',
//                 cursor: 'pointer',
//                 WebkitAppearance: 'none',
//                 WebkitTapHighlightColor: 'transparent'
//               }}
//             >
//               {vehicleProfiles.map(profile => (
//                 <option key={profile.value} value={profile.value}>
//                   {profile.icon} {profile.label}
//                 </option>
//               ))}
//             </select>
//           </div>

//           <button
//             onClick={handleFindRoute}
//             disabled={isLoading || !startAddress.trim() || !endAddress.trim()}
//             style={{
//               padding: isMobile ? '10px 16px' : isTablet ? '11px 18px' : '12px 20px',
//               background: isLoading || !startAddress.trim() || !endAddress.trim() 
//                 ? 'rgba(156,163,175,0.8)' 
//                 : 'linear-gradient(135deg, #f59e0b, #d97706)',
//               border: 'none',
//               borderRadius: isMobile ? '8px' : '10px',
//               color: 'white',
//               fontSize: isMobile ? '13px' : '14px',
//               fontWeight: '700',
//               cursor: isLoading || !startAddress.trim() || !endAddress.trim() ? 'not-allowed' : 'pointer',
//               transition: 'all 0.2s ease',
//               boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
//               letterSpacing: '0.02em',
//               WebkitTapHighlightColor: 'transparent',
//               gridColumn: isMobile ? '1' : 'auto',
//               whiteSpace: 'nowrap'
//             }}
//             onTouchStart={(e) => {
//               if (!isLoading && startAddress.trim() && endAddress.trim()) {
//                 e.target.style.transform = 'scale(0.95)';
//               }
//             }}
//             onTouchEnd={(e) => {
//               e.target.style.transform = 'scale(1)';
//             }}
//           >
//             {isLoading ? '⏳' : '🚀 Route'}
//           </button>
//         </div>

//         {/* Compact Route Info */}
//         {routeData && routeData.features && routeData.features[0] && (
//           <div style={{ 
//             background: 'rgba(34,197,94,0.12)',
//             backdropFilter: 'blur(15px)',
//             padding: isMobile ? '8px 12px' : isTablet ? '10px 16px' : '12px 20px',
//             borderBottom: '1px solid rgba(255,255,255,0.08)',
//             display: 'flex',
//             gap: isMobile ? '16px' : '24px',
//             alignItems: 'center',
//             flexWrap: 'nowrap',
//             overflowX: isMobile ? 'auto' : 'visible',
//             WebkitOverflowScrolling: 'touch'
//           }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
//               <div style={{
//                 width: '24px',
//                 height: '24px',
//                 borderRadius: '50%',
//                 background: 'linear-gradient(135deg, #10b981, #059669)',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 fontSize: '12px'
//               }}>📏</div>
//               <div>
//                 <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '500' }}>Distance</div>
//                 <div style={{ color: 'white', fontSize: isMobile ? '14px' : '16px', fontWeight: '700' }}>
//                   {formatDistance(routeData.features[0].properties.segments[0].distance)}
//                 </div>
//               </div>
//             </div>
            
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
//               <div style={{
//                 width: '24px',
//                 height: '24px',
//                 borderRadius: '50%',
//                 background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 fontSize: '12px'
//               }}>⏱️</div>
//               <div>
//                 <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '500' }}>Duration</div>
//                 <div style={{ color: 'white', fontSize: isMobile ? '14px' : '16px', fontWeight: '700' }}>
//                   {formatDuration(routeData.features[0].properties.segments[0].duration)}
//                 </div>
//               </div>
//             </div>
            
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
//               <div style={{
//                 width: '24px',
//                 height: '24px',
//                 borderRadius: '50%',
//                 background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'center',
//                 fontSize: '12px'
//               }}>🚛</div>
//               <div>
//                 <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '500' }}>Vehicle</div>
//                 <div style={{ color: 'white', fontSize: isMobile ? '12px' : '14px', fontWeight: '600' }}>
//                   {vehicleProfiles.find(p => p.value === vehicleProfile)?.label}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Map */}
//         <div style={{ 
//           flex: 1, 
//           position: 'relative',
//           overflow: 'hidden',
//           touchAction: 'none'
//         }}>
//           <MapContainer
//             ref={mapRef}
//             center={[20.5937, 78.9629]}
//             zoom={5}
//             style={{ height: '100%', width: '100%' }}
//             scrollWheelZoom={!isMobile}
//             touchZoom={true}
//             tap={true}
//             dragging={true}
//             doubleClickZoom={true}
//             zoomControl={!isMobile}
//           >
//             <TileLayer
//               attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//             />
            
//             {currentLocation && (
//               <Marker 
//                 position={[currentLocation.lat, currentLocation.lng]}
//                 icon={new L.Icon({
//                   iconUrl: 'data:image/svg+xml;base64,' + btoa(`
//                     <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
//                       <circle cx="16" cy="16" r="12" fill="#667eea" stroke="#ffffff" stroke-width="3"/>
//                       <circle cx="16" cy="16" r="5" fill="#ffffff"/>
//                       <circle cx="16" cy="16" r="12" fill="none" stroke="#667eea" stroke-width="1" opacity="0.3"/>
//                     </svg>
//                   `),
//                   iconSize: [32, 32],
//                   iconAnchor: [16, 16],
//                   popupAnchor: [0, -16]
//                 })}
//               >
//                 <Popup>
//                   <div style={{ textAlign: 'center', fontWeight: '600', fontSize: isMobile ? '12px' : '14px' }}>
//                     <strong>Your Location</strong><br />
//                     <small>Lat: {currentLocation.lat.toFixed(6)}</small><br />
//                     <small>Lng: {currentLocation.lng.toFixed(6)}</small>
//                   </div>
//                 </Popup>
//               </Marker>
//             )}
            
//             {startPoint && (!currentLocation || 
//               startPoint.lat !== currentLocation.lat || 
//               startPoint.lng !== currentLocation.lng) && (
//               <Marker position={[startPoint.lat, startPoint.lng]}>
//                 <Popup>
//                   <div style={{ fontSize: isMobile ? '12px' : '14px' }}>
//                     <strong>Start</strong><br />
//                     {startAddress}
//                   </div>
//                 </Popup>
//               </Marker>
//             )}
            
//             {endPoint && (
//               <Marker position={[endPoint.lat, endPoint.lng]}>
//                 <Popup>
//                   <div style={{ fontSize: isMobile ? '12px' : '14px' }}>
//                     <strong>Destination</strong><br />
//                     {endAddress}
//                   </div>
//                 </Popup>
//               </Marker>
//             )}

//             <RouteLayer 
//               start={startPoint} 
//               end={endPoint} 
//               vehicleProfile={vehicleProfile}
//               routeData={routeData}
//               setRouteData={setRouteData}
//             />
//           </MapContainer>

//           {/* Mobile-specific map controls */}
//           {isMobile && (
//             <div style={{
//               position: 'absolute',
//               top: '12px',
//               right: '12px',
//               display: 'flex',
//               flexDirection: 'column',
//               gap: '6px',
//               zIndex: 1000
//             }}>
//               <button
//                 onClick={() => {
//                   if (mapRef.current) {
//                     mapRef.current.setZoom(mapRef.current.getZoom() + 1);
//                   }
//                 }}
//                 style={{
//                   width: '32px',
//                   height: '32px',
//                   borderRadius: '50%',
//                   background: 'rgba(255,255,255,0.9)',
//                   backdropFilter: 'blur(10px)',
//                   border: 'none',
//                   fontSize: '16px',
//                   fontWeight: 'bold',
//                   color: '#333',
//                   cursor: 'pointer',
//                   boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
//                   WebkitTapHighlightColor: 'transparent',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center'
//                 }}
//                 onTouchStart={(e) => e.target.style.transform = 'scale(0.9)'}
//                 onTouchEnd={(e) => e.target.style.transform = 'scale(1)'}
//               >
//                 +
//               </button>
//               <button
//                 onClick={() => {
//                   if (mapRef.current) {
//                     mapRef.current.setZoom(mapRef.current.getZoom() - 1);
//                   }
//                 }}
//                 style={{
//                   width: '32px',
//                   height: '32px',
//                   borderRadius: '50%',
//                   background: 'rgba(255,255,255,0.9)',
//                   backdropFilter: 'blur(10px)',
//                   border: 'none',
//                   fontSize: '16px',
//                   fontWeight: 'bold',
//                   color: '#333',
//                   cursor: 'pointer',
//                   boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
//                   WebkitTapHighlightColor: 'transparent',
//                   display: 'flex',
//                   alignItems: 'center',
//                   justifyContent: 'center'
//                 }}
//                 onTouchStart={(e) => e.target.style.transform = 'scale(0.9)'}
//                 onTouchEnd={(e) => e.target.style.transform = 'scale(1)'}
//               >
//                 −
//               </button>
//             </div>
//           )}
//         </div>

//         {/* Compact Footer */}
//         <div style={{ 
//           background: 'rgba(0,0,0,0.8)',
//           backdropFilter: 'blur(15px)',
//           padding: isMobile ? '8px 12px' : isTablet ? '10px 16px' : '12px 20px',
//           fontSize: isMobile ? '11px' : '12px',
//           color: 'rgba(255,255,255,0.7)',
//           textAlign: 'center',
//           display: 'flex',
//           justifyContent: 'space-between',
//           alignItems: 'center',
//           flexWrap: 'wrap',
//           gap: '12px'
//         }}>
//           <span>Premium routing with AI-powered suggestions</span>
//           {currentLocation && (
//             <span style={{ 
//               color: '#10b981', 
//               fontWeight: '600',
//               display: 'flex',
//               alignItems: 'center',
//               gap: '6px'
//             }}>
//               <div style={{
//                 width: '6px',
//                 height: '6px',
//                 borderRadius: '50%',
//                 background: '#10b981',
//                 animation: 'pulse 2s infinite'
//               }} />
//               Live Location
//             </span>
//           )}
//         </div>
        
//         {/* Compact CSS with space-efficient navigation */}
//         <style jsx>{`
//           /* Compact Navigation Styles */
//           .compact-nav {
//             padding: 4px 8px !important;
//             font-size: 12px !important;
//             line-height: 1.2 !important;
//             margin: 2px !important;
//           }
          
//           .compact-input {
//             padding: 8px 12px !important;
//             font-size: 14px !important;
//             line-height: 1.3 !important;
//           }
          
//           .compact-button {
//             padding: 8px 12px !important;
//             font-size: 13px !important;
//             min-height: 32px !important;
//           }
          
//           .compact-label {
//             font-size: 12px !important;
//             margin-bottom: 2px !important;
//             font-weight: 600 !important;
//           }
          
//           .compact-grid {
//             gap: 8px !important;
//             grid-template-rows: auto !important;
//           }
          
//           /* Mobile-first compact navigation */
//           @media (max-width: 767px) {
//             .compact-nav {
//               padding: 6px 10px !important;
//               font-size: 11px !important;
//             }
            
//             .compact-input {
//               padding: 10px 12px !important;
//               font-size: 14px !important;
//             }
            
//             .compact-button {
//               padding: 10px 14px !important;
//               font-size: 12px !important;
//             }
//           }
          
//           /* Tablet compact navigation */
//           @media (min-width: 768px) and (max-width: 1023px) {
//             .compact-grid {
//               grid-template-columns: 1fr 1fr 120px 80px !important;
//               gap: 10px !important;
//             }
//           }
          
//           /* Desktop compact navigation */
//           @media (min-width: 1024px) {
//             .compact-grid {
//               grid-template-columns: 1fr 1fr 140px 100px !important;
//               gap: 12px !important;
//             }
//           }
          
//           @keyframes pulse {
//             0% { opacity: 1; transform: scale(1); }
//             50% { opacity: 0.7; transform: scale(1.1); }
//             100% { opacity: 1; transform: scale(1); }
//           }
          
//           /* Enhanced mobile touch styles */
//           * {
//             -webkit-tap-highlight-color: transparent;
//             -webkit-touch-callout: none;
//             -webkit-user-select: none;
//             -khtml-user-select: none;
//             -moz-user-select: none;
//             -ms-user-select: none;
//             user-select: none;
//           }
          
//           input, textarea {
//             -webkit-user-select: text;
//             -khtml-user-select: text;
//             -moz-user-select: text;
//             -ms-user-select: text;
//             user-select: text;
//           }
          
//           /* Smooth scrolling for all elements */
//           * {
//             scroll-behavior: smooth;
//             -webkit-overflow-scrolling: touch;
//           }
          
//           /* Custom scrollbar styles */
//           ::-webkit-scrollbar {
//             width: 4px;
//             height: 4px;
//           }
          
//           ::-webkit-scrollbar-track {
//             background: rgba(255,255,255,0.1);
//             border-radius: 2px;
//           }
          
//           ::-webkit-scrollbar-thumb {
//             background: rgba(102,126,234,0.3);
//             border-radius: 2px;
//           }
          
//           ::-webkit-scrollbar-thumb:hover {
//             background: rgba(102,126,234,0.5);
//           }
          
//           /* Mobile-specific optimizations */
//           @media (max-width: 767px) {
//             body {
//               overflow-x: hidden;
//             }
            
//             .leaflet-container {
//               background: #667eea !important;
//             }
            
//             .leaflet-popup-content-wrapper {
//               border-radius: 10px !important;
//               font-size: 11px !important;
//             }
            
//             .leaflet-popup-tip {
//               border-radius: 2px !important;
//             }
            
//             /* Disable text selection on mobile for better UX */
//             .leaflet-container {
//               -webkit-user-select: none;
//               -moz-user-select: none;
//               -ms-user-select: none;
//               user-select: none;
//             }
//           }
          
//           /* Compact space utilization */
//           .search-container {
//             margin: 0 !important;
//             padding: 0 !important;
//           }
          
//           .search-container input,
//           .search-container select,
//           .search-container button {
//             margin: 0 !important;
//           }
          
//           /* iOS Safari specific fixes */
//           @supports (-webkit-touch-callout: none) {
//             .search-container input {
//               font-size: 16px !important;
//               transform: translateZ(0);
//             }
            
//             .search-container select {
//               font-size: 16px !important;
//             }
//           }
          
//           /* Focus styles for accessibility */
//           button:focus-visible,
//           input:focus-visible,
//           select:focus-visible {
//             outline: 2px solid #667eea !important;
//             outline-offset: 1px !important;
//           }
          
//           /* Loading states */
//           button:disabled {
//             opacity: 0.6;
//             cursor: not-allowed;
//             transform: none !important;
//             pointer-events: none;
//           }
          
//           /* Enhanced touch feedback */
//           button:active:not(:disabled) {
//             transform: scale(0.95);
//             transition: transform 0.1s ease;
//           }
          
//           /* Minimal space grid layout */
//           .minimal-grid {
//             display: grid;
//             grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
//             gap: 6px;
//             align-items: center;
//           }
          
//           /* Compact form elements */
//           .form-compact {
//             display: flex;
//             flex-direction: column;
//             gap: 4px;
//           }
          
//           .form-compact label {
//             font-size: 11px;
//             font-weight: 600;
//             color: rgba(255,255,255,0.8);
//             margin: 0;
//             padding: 0;
//           }
          
//           .form-compact input,
//           .form-compact select {
//             padding: 8px 10px;
//             font-size: 13px;
//             border-radius: 6px;
//             border: 1px solid rgba(255,255,255,0.2);
//           }
          
//           /* Ultra-compact mobile layout */
//           @media (max-width: 480px) {
//             .ultra-compact {
//               padding: 4px 8px !important;
//               font-size: 10px !important;
//               gap: 4px !important;
//             }
//           }
//         `}</style>
//       </div>
//     </>
//   );
// };

// export default App;










