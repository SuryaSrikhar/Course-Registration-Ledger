const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const api = {
  async health() {
    return request("/health");
  },
  async getContractConfig() {
    return request("/contract-config");
  },
  async getCourses() {
    return request("/courses");
  },
  async createCourse(payload) {
    return request("/create-course", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async enroll(payload) {
    return request("/enroll", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async drop(payload) {
    return request("/drop", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
