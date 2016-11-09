let socket;
let games = {};

$(document).on("ready", (e) => {
	socket = new WebSocket("ws://50.16.122.48:62951/");

	socket.onopen = (e) => {
		console.log("Connected!");
	};

	socket.onmessage = (e) => {
		const messageParts = e.data.split("$");
		const messageType = messageParts.shift();
		if (messageType !== undefined) {
			const routerAction = messageRouter[messageType];
			const replyPayload = routerAction(messageParts);
			if (!replyPayload) {
				return;
			}
			socket.send(replyPayload);
		}
	};

	$(document).on("click", ".server", (e) => {
		const id = $(e.target).parent().attr("data-id");
		const address = `http://slay.one?game=${id}`;
		window.open(address, "_blank");
	});

});

const messageRouter = {
	"rdy2AutoLogin": (payload) => {
		// everything is good, ready to get started
		return "req-games-list";
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
				map: parseInt(payload[2]),
				mode: parseInt(payload[3]),
				players: 0,
				max: parseInt(payload[4])
			};
			games[game.id] = game;
			addRow(game);
		}
		refreshTable();
		return false;
	}
};

function refreshTable() {
	$("#games-list").html("");
	for (const id in games) {
		addRow(games[id]);
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
	`);
	$("#games-list").append(row);
}

function getMode(code) {
	switch (code) {
	case 0:
		return "Zombie Deathmatch";
	case 1:
		return "Team Deathmatch";
	case 2:
		return "Capture The Flag";
	case 3:
		return "Deathmatch";
	}
	return `Unknown: ${code}`;
}
