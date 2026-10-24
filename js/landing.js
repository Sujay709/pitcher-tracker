const ROLE_STORAGE_KEY = "pitcherTracker.role";

export function getLandingRedirect(storedRole, queryString) {
    const params = new URLSearchParams(queryString);
    if (params.has("choose")) {
        return null;
    }

    if (storedRole === "player") {
        return "player.html";
    }
    if (storedRole === "coach") {
        return "coach.html";
    }
    return null;
}

export function loadStoredRole() {
    try {
        const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
        return storedRole === "player" || storedRole === "coach"
            ? storedRole
            : null;
    } catch (error) {
        console.error("Could not read saved role:", error);
        return null;
    }
}

export function saveStoredRole(role) {
    if (role !== "player" && role !== "coach") {
        return;
    }
    try {
        localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch (error) {
        console.error("Could not save selected role:", error);
    }
}

export function clearStoredRole() {
    try {
        localStorage.removeItem(ROLE_STORAGE_KEY);
    } catch (error) {
        console.error("Could not clear saved role:", error);
    }
}

function initializeLandingPage() {
    const rememberChoice = document.getElementById("remember-choice");
    const roleLinks = document.querySelectorAll("[data-role]");
    if (!rememberChoice || roleLinks.length === 0) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has("choose")) {
        clearStoredRole();
    } else {
        const redirect = getLandingRedirect(
            loadStoredRole(),
            window.location.search,
        );
        if (redirect) {
            window.location.replace(redirect);
            return;
        }
    }

    for (const link of roleLinks) {
        link.addEventListener("click", () => {
            if (rememberChoice.checked) {
                saveStoredRole(link.dataset.role);
            }
        });
    }
}

initializeLandingPage();
