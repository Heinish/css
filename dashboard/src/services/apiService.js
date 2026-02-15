/**
 * API Service for communicating with Raspberry Pi agents
 * All functions return promises and handle errors gracefully
 */

const axios = require('axios');

// Timeout for API calls (5 seconds)
const API_TIMEOUT = 5000;

class ApiService {
  /**
   * Get Pi status including stats and configuration
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Status object with name, room, uptime, cpu, memory, etc.
   */
  static async getPiStatus(ip) {
    try {
      const response = await axios.get(`http://${ip}:5000/api/status`, {
        timeout: API_TIMEOUT
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Get Pi configuration
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Configuration object
   */
  static async getPiConfig(ip) {
    try {
      const response = await axios.get(`http://${ip}:5000/api/config`, {
        timeout: API_TIMEOUT
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Update Pi configuration
   * @param {string} ip - Pi IP address
   * @param {object} config - Configuration updates {name, room, display_url}
   * @returns {Promise<object>} Success response
   */
  static async updatePiConfig(ip, config) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/config`,
        config,
        { timeout: API_TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Change displayed URL on Pi
   * @param {string} ip - Pi IP address
   * @param {string} url - New URL to display
   * @returns {Promise<object>} Success response
   */
  static async changeUrl(ip, url) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/display/url`,
        { url },
        { timeout: API_TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Restart browser on Pi
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Success response
   */
  static async restartBrowser(ip) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/browser/restart`, {}, {
        timeout: API_TIMEOUT
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Reboot Pi system
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Success response
   */
  static async rebootPi(ip) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/system/reboot`, {}, {
        timeout: API_TIMEOUT
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Get screenshot from Pi display
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Screenshot blob or error
   */
  static async getScreenshot(ip) {
    try {
      const response = await axios.get(`http://${ip}:5000/api/display/screenshot`, {
        timeout: 10000, // Longer timeout for screenshot
        responseType: 'blob'
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Rotate display orientation
   * @param {string} ip - Pi IP address
   * @param {number} rotation - Rotation angle (0, 90, 180, 270)
   * @returns {Promise<object>} Success response
   */
  static async rotateDisplay(ip, rotation) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/display/rotate`,
        { rotation },
        { timeout: API_TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Configure network IP address
   * @param {string} ip - Pi current IP address
   * @param {object} config - Network configuration {mode, ip, netmask, gateway, dns, auto_reboot}
   * @returns {Promise<object>} Success response with new IP
   */
  static async configureNetwork(ip, config) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/network/ip`,
        config,
        { timeout: API_TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Get auto-update settings
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Auto-update settings
   */
  static async getAutoUpdateSettings(ip) {
    try {
      const response = await axios.get(`http://${ip}:5000/api/settings/autoupdate`, {
        timeout: API_TIMEOUT
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Set auto-update settings
   * @param {string} ip - Pi IP address
   * @param {boolean} enabled - Enable or disable auto-update
   * @returns {Promise<object>} Success response
   */
  static async setAutoUpdateSettings(ip, enabled) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/settings/autoupdate`,
        { enabled },
        { timeout: API_TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Get daily reboot settings
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Reboot settings
   */
  static async getRebootSettings(ip) {
    try {
      const response = await axios.get(`http://${ip}:5000/api/settings/reboot`, {
        timeout: API_TIMEOUT
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Set daily reboot settings
   * @param {string} ip - Pi IP address
   * @param {boolean} enabled - Enable or disable daily reboot
   * @returns {Promise<object>} Success response
   */
  static async setRebootSettings(ip, enabled) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/settings/reboot`,
        { enabled },
        { timeout: API_TIMEOUT }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Update Pi from GitHub
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Update result with output
   */
  static async updatePi(ip) {
    try {
      const response = await axios.post(`http://${ip}:5000/api/update`, {}, {
        timeout: 30000 // 30 seconds for git pull
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Health check endpoint
   * @param {string} ip - Pi IP address
   * @returns {Promise<object>} Health status
   */
  static async healthCheck(ip) {
    try {
      const response = await axios.get(`http://${ip}:5000/api/health`, {
        timeout: 3000 // Quick timeout for health check
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  /**
   * Format error message for display
   * @param {Error} error - Axios error object
   * @returns {string} Formatted error message
   */
  static formatError(error) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout - Pi not responding';
    } else if (error.code === 'ECONNREFUSED') {
      return 'Connection refused - API not running';
    } else if (error.code === 'ETIMEDOUT') {
      return 'Connection timeout - Pi not reachable';
    } else if (error.response) {
      return error.response.data?.error || `Server error: ${error.response.status}`;
    } else if (error.request) {
      return 'No response from Pi - check network connection';
    } else {
      return error.message || 'Unknown error occurred';
    }
  }
}

module.exports = ApiService;
