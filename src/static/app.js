document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupContainer = document.getElementById("signup-container");
  const signupHelper = document.getElementById("signup-helper");

  const userMenuBtn = document.getElementById("user-menu-btn");
  const authMenu = document.getElementById("auth-menu");
  const authStatusText = document.getElementById("auth-status-text");
  const openLoginBtn = document.getElementById("open-login-btn");
  const logoutBtn = document.getElementById("logout-btn");

  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginBtn = document.getElementById("close-login-btn");
  const loginMessage = document.getElementById("login-message");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";
  let isTeacher = Boolean(authToken);

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showLoginMessage(text, type = "error") {
    loginMessage.textContent = text;
    loginMessage.className = type;
    loginMessage.classList.remove("hidden");
  }

  function clearLoginMessage() {
    loginMessage.textContent = "";
    loginMessage.className = "hidden";
  }

  function openLoginModal() {
    clearLoginMessage();
    loginForm.reset();
    loginModal.classList.remove("hidden");
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
  }

  function updateAuthUI() {
    if (isTeacher) {
      authStatusText.textContent = `Teacher: ${teacherUsername}`;
      openLoginBtn.textContent = "Switch Account";
      logoutBtn.classList.remove("hidden");
      signupForm.classList.remove("hidden");
      signupHelper.textContent = "Teacher mode enabled. You can register students from this form or unregister from activity cards.";
    } else {
      authStatusText.textContent = "Student Mode";
      openLoginBtn.textContent = "Teacher Login";
      logoutBtn.classList.add("hidden");
      signupForm.classList.add("hidden");
      signupHelper.textContent = "Teacher login is required to register or unregister students.";
    }
  }

  async function validateExistingSession() {
    if (!authToken) {
      isTeacher = false;
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json();
      isTeacher = Boolean(result.authenticated);
      if (!isTeacher) {
        authToken = "";
        teacherUsername = "";
        localStorage.removeItem("teacherAuthToken");
        localStorage.removeItem("teacherUsername");
      }
    } catch (error) {
      isTeacher = false;
      authToken = "";
      teacherUsername = "";
      localStorage.removeItem("teacherAuthToken");
      localStorage.removeItem("teacherUsername");
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacher
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacher || !authToken) {
      showMessage("Teacher login is required to unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearLoginMessage();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showLoginMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      teacherUsername = result.username;
      isTeacher = true;

      localStorage.setItem("teacherAuthToken", authToken);
      localStorage.setItem("teacherUsername", teacherUsername);

      updateAuthUI();
      closeLoginModal();
      authMenu.classList.add("hidden");
      fetchActivities();
      showMessage("Teacher login successful.", "success");
    } catch (error) {
      showLoginMessage("Unable to login right now. Please try again.", "error");
    }
  }

  async function handleLogout() {
    if (authToken) {
      try {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }

    authToken = "";
    teacherUsername = "";
    isTeacher = false;
    localStorage.removeItem("teacherAuthToken");
    localStorage.removeItem("teacherUsername");
    updateAuthUI();
    authMenu.classList.add("hidden");
    fetchActivities();
    showMessage("Logged out. Student mode active.", "info");
  }

  userMenuBtn.addEventListener("click", () => {
    authMenu.classList.toggle("hidden");
  });

  openLoginBtn.addEventListener("click", () => {
    authMenu.classList.add("hidden");
    openLoginModal();
  });

  closeLoginBtn.addEventListener("click", closeLoginModal);
  logoutBtn.addEventListener("click", handleLogout);
  loginForm.addEventListener("submit", handleLogin);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacher || !authToken) {
      showMessage("Teacher login is required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  validateExistingSession();
  fetchActivities();
});
