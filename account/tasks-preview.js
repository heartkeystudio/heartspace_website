(function () {
    "use strict";

    const projectId = "gamejam-preview";
    const storageKey = "heartspace-tasks-preview-data-v2";
    const sprintStorageKey = "heartspace-tasks-preview-sprints-v2";
    const commentStorageKey = "heartspace-tasks-preview-comments-v2";
    const members = [
        { user_id: "member-ana", display_name: "Ana Souza" },
        { user_id: "member-caio", display_name: "Caio Lima" },
        { user_id: "member-lu", display_name: "Lu Martins" },
        { user_id: "member-ren", display_name: "Ren Oliveira" }
    ];
    const seed = [
        { id: "preview-1", title: "Definir o loop principal", description: JSON.stringify({ text: "Fechar a sequência central de gameplay para a primeira versão.", priority: "high" }), acceptance_criteria: [{ id: "preview-criterion-1", text: "A pessoa jogadora consegue completar o ciclo principal.", approved_at: "2026-10-18T15:00:00.000Z", approved_by: "member-ana" }], status: "done", sort_order: 1, assigned_to: "member-ana", sprint_id: "sprint-preview-1" },
        { id: "preview-2", title: "Implementar movimentação do personagem", description: JSON.stringify({ text: "Adicionar corrida, pulo e colisão com o cenário.", priority: "normal" }), acceptance_criteria: [{ id: "preview-criterion-2", text: "O personagem corre e pula com resposta imediata.", approved_at: null, approved_by: null }, { id: "preview-criterion-3", text: "A colisão impede atravessar o cenário.", approved_at: null, approved_by: null }], status: "in_progress", sort_order: 2, assigned_to: "member-caio", sprint_id: "sprint-preview-1" },
        { id: "preview-3", title: "Criar tela de início", description: JSON.stringify({ text: "Título, botão de jogar e créditos básicos." }), status: "todo", sort_order: 1, assigned_to: "member-lu" },
        { id: "preview-4", title: "Revisar efeitos sonoros", description: JSON.stringify({ text: "Conferir volumes e feedback dos eventos principais." }), status: "review", sort_order: 1, assigned_to: "member-ren" }
    ];
    const seedSprints = [{ id: "sprint-preview-1", project_id: projectId, name: "Sprint Game Jam", goal: "Ter o loop de jogo jogável para a próxima revisão.", start_date: "2026-10-17", end_date: "2026-10-18", status: "active", sort_order: 1 }];
    let memoryRows = null;
    let memorySprints = null;
    let memoryComments = null;

    function readRows() {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch (_) { /* file:// pode não disponibilizar localStorage; a prévia continua em memória. */ }
        return memoryRows ? memoryRows.slice() : seed.map(function (row) { return Object.assign({}, row); });
    }
    function writeRows(rows) {
        memoryRows = rows.slice();
        try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch (_) { /* Mantém as alterações em memória nesta aba. */ }
    }
    function readStored(key, memory, fallback) {
        try { const saved = localStorage.getItem(key); if (saved) return JSON.parse(saved); } catch (_) { /* Mantém a prévia em memória se o navegador bloquear o armazenamento local. */ }
        return memory || fallback.map(function (row) { return Object.assign({}, row); });
    }
    function writeStored(key, rows, setter) {
        setter(rows.slice());
        try { localStorage.setItem(key, JSON.stringify(rows)); } catch (_) { /* A prévia continua funcionando nesta aba. */ }
    }

    const api = {
        list: async function (requestedProject) { return requestedProject === projectId ? readRows() : []; },
        create: async function (payload) {
            const rows = readRows();
            rows.push(Object.assign({ id: "preview-" + Date.now(), created_at: new Date().toISOString() }, payload));
            writeRows(rows);
        },
        update: async function (taskId, patch) {
            const rows = readRows();
            const task = rows.find(function (row) { return row.id === taskId; });
            if (!task) throw new Error("Esta tarefa de demonstração não foi encontrada.");
            Object.assign(task, patch); writeRows(rows);
        },
        deleteTask: async function (taskId) {
            writeRows(readRows().filter(function (row) { return row.id !== taskId; }));
            const comments = readStored(commentStorageKey, memoryComments, []).filter(function (comment) { return comment.task_id !== taskId; });
            writeStored(commentStorageKey, comments, function (rows) { memoryComments = rows; });
        },
        listSprints: async function () { return readStored(sprintStorageKey, memorySprints, seedSprints); },
        updateSprint: async function (sprintId, patch) { const sprints = readStored(sprintStorageKey, memorySprints, seedSprints); const sprint = sprints.find(function (row) { return row.id === sprintId; }); if (sprint) Object.assign(sprint, patch); writeStored(sprintStorageKey, sprints, function (rows) { memorySprints = rows; }); },
        createSprint: async function (payload) {
            const sprints = readStored(sprintStorageKey, memorySprints, seedSprints);
            sprints.push(Object.assign({ id: "sprint-" + Date.now() }, payload)); writeStored(sprintStorageKey, sprints, function (rows) { memorySprints = rows; });
        },
        moveSprintTasksToBacklog: async function (sprintId) {
            const rows = readRows(); rows.forEach(function (row) { if (String(row.sprint_id || "") === String(sprintId)) row.sprint_id = null; }); writeRows(rows);
        },
        deleteSprint: async function (sprintId) {
            const sprints = readStored(sprintStorageKey, memorySprints, seedSprints).filter(function (row) { return row.id !== sprintId; });
            writeStored(sprintStorageKey, sprints, function (rows) { memorySprints = rows; });
        },
        listComments: async function (taskId) { return readStored(commentStorageKey, memoryComments, []).filter(function (comment) { return comment.task_id === taskId; }); },
        createComment: async function (payload) {
            const comments = readStored(commentStorageKey, memoryComments, []);
            comments.push(Object.assign({ id: "comment-" + Date.now(), created_at: new Date().toISOString() }, payload));
            writeStored(commentStorageKey, comments, function (rows) { memoryComments = rows; });
        }
    };

    const app = window.HeartspaceTasks.create(document.querySelector("[data-workspace-panel=tasks]"), {
        api: api,
        getProjectId: function () { return projectId; },
        getProjectName: function () { return "Game Jam · Projeto de demonstração"; },
        getMembers: function () { return members; },
        canApproveTasks: function () { return true; },
        getUserId: function () { return "member-ana"; },
        getUserName: function () { return "Ana Souza"; },
        syncLabel: "simulação local"
    });
    app.setProject(projectId);

    document.getElementById("resetPreview").addEventListener("click", function () {
        writeRows(seed.map(function (row) { return Object.assign({}, row); }));
        writeStored(sprintStorageKey, seedSprints.map(function (row) { return Object.assign({}, row); }), function (rows) { memorySprints = rows; });
        writeStored(commentStorageKey, [], function (rows) { memoryComments = rows; });
        app.load();
    });
}());
