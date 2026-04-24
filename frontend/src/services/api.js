const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
let authToken = "";

export function setAuthToken(token) {
  authToken = String(token || "").trim();
}

async function request(path, options = {}) {
  const extraHeaders = options.headers || {};
  if (authToken) {
    extraHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders
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
  async registerStudent(payload) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async login(payload) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async logout() {
    return request("/auth/logout", { method: "POST" });
  },
  async me() {
    return request("/auth/me");
  },
  async health() {
    return request("/health");
  },
  async getContractConfig() {
    return request("/contract-config");
  },
  async getCourses() {
    return request("/courses");
  },
  async getStudents() {
    return request("/admin/students");
  },
  async createCourse(payload) {
    return request("/admin/create-course", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async updateCourseCapacity(payload) {
    return request("/admin/update-course-capacity", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async getEnrollmentRequests() {
    return request("/admin/enrollment-requests");
  },
  async decideEnrollmentRequest(requestId, payload) {
    return request(`/admin/enrollment-requests/${requestId}/decision`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async adminDropStudent(payload) {
    return request("/admin/drop-student", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async syncStudentWallet(payload) {
    return request("/student/sync-wallet", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async enroll(payload) {
    return request("/student/enroll", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async drop(payload) {
    return request("/student/drop", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
