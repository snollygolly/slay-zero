let socket;
const username = "slayzero";
const password = "password";
const games = {};

$(document).on("ready", (e) => {
	socket = new WebSocket("ws://50.16.122.48:62951/");

	socket.onopen = (e) => {
		console.log("Connected!");
		socket.send("plSettings$AutomatedScanner");
	};

	socket.onmessage = (e) => {
		const messageParts = e.data.split("$");
		const messageType = messageParts.shift();
		if (messageType !== undefined) {
			const routerAction = messageRouter[messageType];
			if (routerAction === undefined) {
				return;
			}
			const replyPayload = routerAction(messageParts);
			if (!replyPayload) {
				return;
			}
			if (typeof replyPayload === "string") {
				// simple reply
				socket.send(replyPayload);
				return;
			}
			for (const reply of replyPayload) {
				socket.send(reply);
			}
		}
	};

	$(document).on("click", "#join-game", (e) => {
		const id = $(e.target).attr("data-id");
		const address = `http://slay.one?game=${id}`;
		window.open(address, "_blank");
	});

	$(document).on("click", "#peek-game", (e) => {
		const id = $(e.target).attr("data-id");
		socket.send(`join-game$${id}`);
	});

});

const messageRouter = {
	"rdy2AutoLogin": (payload) => {
		// everything is good, ready to get started
		return ["mu", "dontListen2GamesList", `login$${username}$${password}$true`];
	},
	"logged-in": (payload) => {
		// everything is good, ready to get started
		return ["mu", "req-games-list"];
	},
	"tgklf": (payload) => {
		// no idea what this does
		return false;
	},
	"ping": (payload) => {
		// we initiate this ping, not the server
		return false;
	},
	"gL": (payload) => {
		console.log("Got initial games list");
		$("#loading").hide();
		// the initial load of the map
		for (let i = 0; i < payload.length; i += 5) {
			// load in the map, games are 5 long
			// $Big One $16 $5 $3 $16
			// map, current players, game id, mode, max players
			const game = {
				id: payload[i + 2],
				map: payload[i],
				mode: parseInt(payload[i + 3]),
				players: parseInt(payload[i + 1]),
				max: parseInt(payload[i + 4])
			};
			// add it to the array
			games[game.id] = game;
			addRow(game);
		}
		return false;
	},
	"gLU": (payload) => {
		// incremental updates to the map
		console.log(`Got update to game ${payload[0]}`);
		const id = payload[0];
		const players = parseInt(payload[1]);
		if (players >= 1) {
			// this is a regular update?
			games[id].players = players;
		} else if (players <= -1) {
			// this game is closing down?
			delete games[id];
		} else {
			// this is a new game
			const game = {
				id: id,
				map: payload[2],
				mode: parseInt(payload[3]),
				players: 0,
				max: parseInt(payload[4])
			};
			games[game.id] = game;
			addRow(game);
		}
		refreshTable();
		return false;
	},
	"init": (payload) => {
		// this is for joining a server
		const playersArr = [];
		const players = payload.join("$").split("%split%")[1].split("$");
		// remove the first item
		players.shift();
		console.log(players);
		for (let i = 0; i < players.length; i += 22) {
			// id-0, name-3, hp-4, armor-5, kills-6, deaths-7, team-12, maxHP-14, clan_tag-16, authLevel-17, souls-18, elo-21
			const player = {
				id: players[i],
				name: players[i + 3],
				hp: parseInt(players[i + 4]),
				armor: parseInt(players[i + 5]),
				kills: parseInt(players[i + 6]),
				deaths: parseInt(players[i + 7]),
				team: parseInt(players[i + 12]),
				maxHP: parseInt(players[i + 14]),
				clanTag: players[i + 16],
				authLevel: players[i + 17],
				souls: parseInt(players[i + 18]),
				elo: parseInt(players[i + 21])
			};
			playersArr.push(player);
		}
		console.log(playersArr);
		populateModal(playersArr);
		return "leave-game";
	}
};

function refreshTable() {
	$("#games-list").html("");
	for (const id in games) {
		addRow(games[id]);
	}
}

function populateModal(players) {
	$("#players-list-body").html("");
	// TODO: add sorting here
	for (const player of players) {
		addPeekRow(player);
	}
}

function addRow(game) {
	// parse out the mode
	const parsedMode = getMode(game.mode);
	// see if the server is full or not
	const parsedAvail = game.players === game.max ? "full" : "open";
	let parsedClass = game.players === game.max ? "danger" : "success";
	if (game.players === 0) {
		parsedClass = "primary";
	}
	const row = document.createElement("tr");
	$(row).attr("id", `game-${game.id}`);
	$(row).attr("data-id", game.id);
	$(row).addClass(`server server-${parsedAvail} ${parsedClass}`);
	$(row).append(`
		<td>#${game.id}</td>
		<td class="map">${game.map}</td>
		<td class="mode">${parsedMode}</td>
		<td class="players-${parsedAvail}"><span class="players">${game.players}</span> / ${game.max}</td>
		<td>
			<button type="button" id="join-game" class="btn btn-default btn-sm" data-id="${game.id}">Join</button>
			<button type="button" id="peek-game" class="btn btn-default btn-sm" data-id="${game.id}" data-toggle="modal" data-target="#peek-modal">Peek</button>
		</td>
	`);
	$("#games-list").append(row);
}

function addPeekRow(player) {
	const parsedAuthLevelClass = getAuthLevelClass(player.authLevel);
	const parsedName = player.clanTag !== "" ? `[${player.clanTag}] ${player.name}` : player.name;
	const parsedTeam = getTeamColor(player.team);

	const row = document.createElement("tr");
	$(row).attr("id", `player-${player.id}`);
	$(row).addClass(`player ${parsedTeam}`);
	$(row).append(`
		<td>#${player.id} ${parsedName}</td>
		<td class="${parsedAuthLevelClass}">HP: ${player.hp}/${player.maxHP}</td>
		<td>${player.kills}:${player.deaths}</td>
		<td>${player.souls}</td>
		<td>${player.elo}</td>
	`);
	$("#players-list-body").append(row);
}

function getTeamColor(code) {
	switch (code) {
	case 0: return "default";
	case 1: return "danger";
	case 2: return "info";
	}
	return "unknown";
}

function getAuthLevelClass(level) {
	switch (level) {
	case 0: return "danger";
	case 2: return "";
	case 8: return "warning";
	case 10: return "info";
	}
	return "unknown";
}

function getAuthLevel(code) {
	switch (code) {
	case 0: return "none";
	case 2: return "bot";
	case 4: return "guest";
	case 6: return "player";
	case 8: return "mod";
	case 10: return "admin";
	}
	return "unknown";
}

function getMode(code) {
	switch (code) {
	case 0: return "Zombie Deathmatch";
	case 1: return "Team Deathmatch";
	case 2: return "Capture The Flag";
	case 3: return "Deathmatch";
	}
	return `Unknown: ${code}`;
}
