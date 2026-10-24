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
