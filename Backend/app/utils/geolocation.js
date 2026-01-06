const geoip = require('geoip-lite');

/**
 * Get location information from IP address
 * @param {string} ip - IP address
 * @returns {string} Formatted location string (e.g., "Manila, Philippines")
 */
const getLocationFromIP = (ip) => {
  try {
    // Handle localhost IPs
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
      // For local development, return a default location or attempt to get from system
      return 'Local Development';
    }

    // Remove IPv6 prefix if present
    const cleanIp = ip.replace('::ffff:', '');

    // Lookup IP location
    const geo = geoip.lookup(cleanIp);

    if (!geo) {
      return 'Unknown';
    }

    // Format: City, Country
    const city = geo.city || null;
    const country = geo.country || null;

    if (city && country) {
      return `${city}, ${country}`;
    } else if (country) {
      return country;
    } else {
      return 'Unknown';
    }
  } catch (error) {
    console.error('Error getting location from IP:', error);
    return 'Unknown';
  }
};

/**
 * Get detailed location information from IP address
 * @param {string} ip - IP address
 * @returns {object} Location details
 */
const getDetailedLocationFromIP = (ip) => {
  try {
    // Handle localhost IPs
    if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') {
      return {
        city: null,
        country: null,
        region: null,
        timezone: null,
        coordinates: null,
        isLocal: true
      };
    }

    // Remove IPv6 prefix if present
    const cleanIp = ip.replace('::ffff:', '');

    // Lookup IP location
    const geo = geoip.lookup(cleanIp);

    if (!geo) {
      return {
        city: null,
        country: null,
        region: null,
        timezone: null,
        coordinates: null,
        isLocal: false
      };
    }

    return {
      city: geo.city || null,
      country: geo.country || null,
      region: geo.region || null,
      timezone: geo.timezone || null,
      coordinates: geo.ll ? { lat: geo.ll[0], lon: geo.ll[1] } : null,
      isLocal: false
    };
  } catch (error) {
    console.error('Error getting detailed location from IP:', error);
    return {
      city: null,
      country: null,
      region: null,
      timezone: null,
      coordinates: null,
      isLocal: false
    };
  }
};

module.exports = {
  getLocationFromIP,
  getDetailedLocationFromIP
};
