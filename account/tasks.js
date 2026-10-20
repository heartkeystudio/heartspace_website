(function () {
    "use strict";

    const statuses = [
        { id: "todo", label: "A fazer" }, { id: "in_progress", label: "Em andamento" },
        { id: "review", label: "Em revisão" }, { id: "done", label: "Concluído" }
    ];
    function statusBucket(value) {
        const status = String(value || "todo").toLowerCase();
        if (["todo", "backlog", "open", "new"].includes(status)) return "todo";
        if (["in_progress", "doing", "in progress", "active"].includes(status)) return "in_progress";
        if (["review", "pending_approval", "awaiting_approval"].includes(status)) return "review";
        if (["done", "completed", "fechado"].includes(status)) return "done";
        return "todo";
    }
    function descriptionState(task) {
        const value = task && task.description;
        if (!value) return {};
        if (typeof value === "object") return Object.assign({}, value);
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === "object" ? Object.assign({}, parsed) : { text: String(parsed || "") };
        } catch (_) { return { text: String(value) }; }
    }
    function priorityLabel(value) {
        const priority = String(value || "normal").toLowerCase();
        return priority === "high" ? "Alta" : priority === "low" ? "Baixa" : priority === "normal" ? "Normal" : String(value);
    }
    function isCompletedSprint(sprint) { return String(sprint && sprint.status || "").toLowerCase() === "completed"; }
    function formatDate(value) {
        if (!value) return "";
        const date = new Date(value + (String(value).length === 10 ? "T12:00:00" : ""));
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }

    function create(root, options) {
        const api = options.api;
        const getMembers = options.getMembers || function () { return []; };
        const canApproveTasks = options.canApproveTasks || function () { return false; };
        const getProjectName = options.getProjectName || function () { return ""; };
        const board = root.querySelector("#tasksBoard");
        const backlog = root.querySelector("#tasksBacklogList");
        const sprintPanel = root.querySelector("#tasksSprints");
        const statusNode = root.querySelector("#tasksStatus");
        const countNode = root.querySelector("#tasksCount");
        const taskDialog = root.querySelector("#createTaskDialog");
        const sprintDialog = root.querySelector("#createSprintDialog");
        const detailsDialog = root.querySelector("#taskDetailsDialog");
        const createForm = root.querySelector("#taskCreateForm");
        const sprintForm = root.querySelector("#sprintCreateForm");
        const detailsForm = root.querySelector("#taskDetailsForm");
        const commentForm = root.querySelector("#taskCommentForm");
        const mineInput = root.querySelector("#tasksOnlyMine");
        const searchInput = root.querySelector("#tasksSearch");
        const sprintSelect = root.querySelector("#tasksActiveSprint");
        let projectId = "";
        let rows = [];
        let sprints = [];
        let activeSprintId = "";
        const collapsedSprints = new Set();
        const expandedCompletedSprints = new Set();
        let pollTimer = null;

        function field(id) { return root.querySelector("#" + id); }
        function message(node, text, state) {
            if (!node) return;
            node.textContent = text || "";
            node.className = "form-status" + (state ? " is-" + state : "");
        }
        function showDialog(dialog) { if (dialog && !dialog.open) dialog.showModal(); }
        function closeDialog(dialog) { if (dialog && dialog.open) dialog.close(); }
        function populateSprintOptions(select, selectedId) {
            if (!select) return;
            select.replaceChildren(new Option("Backlog geral", ""));
            sprints.filter(function (sprint) { return !isCompletedSprint(sprint) || String(sprint.id) === String(selectedId || ""); }).forEach(function (sprint) { select.add(new Option((sprint.name || "Sprint") + (isCompletedSprint(sprint) ? " · concluída" : ""), sprint.id)); });
            if (selectedId) select.value = selectedId;
        }
        function populateMemberOptions(select, selectedId) {
            if (!select) return;
            select.replaceChildren(new Option("Sem responsável", ""));
            getMembers().forEach(function (member) { select.add(new Option(member.display_name || member.email || "Membro", member.user_id)); });
            select.value = selectedId || "";
        }
        function memberName(userId) {
            const member = getMembers().find(function (item) { return String(item.user_id) === String(userId); });
            return member ? (member.display_name || member.email || "Membro") : "Sem responsável";
        }
        function taskFor(id) { return rows.find(function (task) { return String(task.id) === String(id); }); }
        function acceptanceCriteria(task) { return Array.isArray(task && task.acceptance_criteria) ? task.acceptance_criteria : []; }
        function allCriteriaApproved(task) { const criteria = acceptanceCriteria(task); return criteria.length > 0 && criteria.every(function (item) { return Boolean(item.approved_at && item.approved_by); }); }
        function byOrder(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")); }
        function orderedTasks(tasks) { return tasks.slice().sort(byOrder); }
        function taskOpenButton(task, compact) {
            const button = document.createElement("button"); button.type = "button"; button.className = compact ? "tasks-backlog-item" : "task-card-open";
            button.dataset.taskOpen = task.id;
            const title = document.createElement("strong"); title.textContent = task.title || "Tarefa sem título"; button.append(title);
            if (compact) {
                const meta = document.createElement("span");
                const desc = descriptionState(task);
                const parts = [memberName(task.assigned_to), priorityLabel(desc.priority || task.priority), desc.due_date ? "Prazo " + formatDate(desc.due_date) : ""].filter(Boolean);
                meta.textContent = parts.join(" · "); button.append(meta);
            }
            if (compact) { const arrow = document.createElement("span"); arrow.className = "tasks-item-arrow"; arrow.textContent = "›"; button.append(arrow); }
            return button;
        }
        function renderSprints() {
            if (!sprintPanel) return;
            sprintPanel.replaceChildren();
            if (!sprints.length) {
                const empty = document.createElement("div"); empty.className = "tasks-empty-action";
                const messageText = document.createElement("p"); messageText.className = "tasks-empty-state"; messageText.textContent = "Ainda não há sprints.";
                const create = document.createElement("button"); create.type = "button"; create.className = "tasks-inline-create"; create.dataset.createSprint = ""; create.textContent = "+ Criar";
                empty.append(messageText, create); sprintPanel.append(empty); return;
            }
            const createSprint = document.createElement("button"); createSprint.type = "button"; createSprint.className = "tasks-inline-create tasks-create-sprint-inline"; createSprint.dataset.createSprint = ""; createSprint.textContent = "+ Criar"; sprintPanel.append(createSprint);
            sprints.slice().sort(byOrder).forEach(function (sprint) {
                const completed = isCompletedSprint(sprint);
                const card = document.createElement("details"); card.className = "tasks-sprint-card" + (completed ? " is-completed" : ""); card.dataset.sprintId = sprint.id;
                card.open = completed ? expandedCompletedSprints.has(String(sprint.id)) : !collapsedSprints.has(String(sprint.id));
                const header = document.createElement("summary"); header.className = "tasks-sprint-summary";
                const handle = document.createElement("span"); handle.className = "tasks-sprint-drag"; handle.textContent = "⠿"; handle.title = "Arraste para reorganizar"; handle.draggable = true; handle.dataset.sprintDrag = sprint.id;
                const info = document.createElement("span"); info.className = "tasks-sprint-info"; const title = document.createElement("strong"); title.textContent = sprint.name || "Sprint";
                const dateLine = document.createElement("small"); dateLine.textContent = [formatDate(sprint.start_date), formatDate(sprint.end_date)].filter(Boolean).join(" – ") || "Datas não definidas";
                info.append(title, dateLine);
                if (completed && sprint.completed_at) { const completedDate = document.createElement("small"); completedDate.className = "tasks-sprint-completed-date"; completedDate.textContent = "Finalizada em " + formatDate(sprint.completed_at); info.append(completedDate); }
                const sprintTasks = orderedTasks(rows.filter(function (task) { return String(task.sprint_id || "") === String(sprint.id); }));
                const count = document.createElement("span"); count.className = "tasks-sprint-count"; count.textContent = sprintTasks.length + (sprintTasks.length === 1 ? " tarefa" : " tarefas"); header.append(handle, info, count);
                if (completed) { const badge = document.createElement("span"); badge.className = "tasks-completed-badge"; badge.textContent = "Concluída"; header.append(badge); }
                else { const deleteSprint = document.createElement("button"); deleteSprint.type = "button"; deleteSprint.className = "tasks-delete-button tasks-sprint-delete"; deleteSprint.dataset.deleteSprint = sprint.id; deleteSprint.setAttribute("aria-label", "Excluir sprint " + (sprint.name || "")); deleteSprint.textContent = "Excluir"; header.append(deleteSprint); }
                card.append(header);
                card.addEventListener("toggle", function () {
                    if (completed) { card.open ? expandedCompletedSprints.add(String(sprint.id)) : expandedCompletedSprints.delete(String(sprint.id)); }
                    else { card.open ? collapsedSprints.delete(String(sprint.id)) : collapsedSprints.add(String(sprint.id)); }
                });
                if (!completed) { const actions = document.createElement("div"); actions.className = "tasks-sprint-actions"; const finish = document.createElement("button"); finish.type = "button"; finish.className = "tasks-complete-button"; finish.dataset.completeSprint = sprint.id; finish.textContent = "Concluir sprint"; actions.append(finish); card.append(actions); }
                if (sprint.goal) { const goal = document.createElement("p"); goal.className = "tasks-sprint-goal"; goal.textContent = sprint.goal; card.append(goal); }
                const list = document.createElement("div"); list.className = "tasks-sprint-task-list" + (completed ? "" : " tasks-dropzone"); if (!completed) list.dataset.dropSprint = sprint.id;
                if (!sprintTasks.length) { const hint = document.createElement("p"); hint.className = "tasks-drop-hint"; hint.textContent = completed ? "Nenhuma tarefa concluída foi registrada nesta sprint." : "Solte tarefas aqui para distribuir nesta sprint"; list.append(hint); }
                sprintTasks.forEach(function (task) { const item = taskOpenButton(task, true); if (!completed) { item.draggable = true; item.dataset.dragTask = task.id; } list.append(item); }); card.append(list);
                sprintPanel.append(card);
            });
        }
        function renderBacklog() {
            if (!backlog) return;
            backlog.replaceChildren();
            const tasks = orderedTasks(rows.filter(function (task) { return !task.sprint_id; }));
            if (countNode) countNode.textContent = tasks.length + (tasks.length === 1 ? " tarefa sem sprint" : " tarefas sem sprint");
            if (!tasks.length) { const empty = document.createElement("p"); empty.className = "tasks-drop-hint"; empty.textContent = "Seu backlog está vazio."; backlog.append(empty); return; }
            tasks.forEach(function (task) { const item = taskOpenButton(task, true); item.draggable = true; item.dataset.dragTask = task.id; backlog.append(item); });
        }
        function renderBoard() {
            if (!board) return;
            board.replaceChildren();
            const query = (searchInput && searchInput.value || "").trim().toLocaleLowerCase();
            const onlyMine = Boolean(mineInput && mineInput.checked);
            if (sprintSelect) {
                const previous = activeSprintId;
                sprintSelect.replaceChildren(new Option("Selecione uma sprint", ""));
                const activeSprints = sprints.filter(function (sprint) { return !isCompletedSprint(sprint); }).sort(byOrder);
                activeSprints.forEach(function (sprint) { sprintSelect.add(new Option(sprint.name || "Sprint", sprint.id)); });
                if (!activeSprints.some(function (sprint) { return String(sprint.id) === String(previous); })) {
                    const preferred = activeSprints.find(function (sprint) { return sprint.status === "active"; }) || activeSprints[0];
                    activeSprintId = preferred ? String(preferred.id) : "";
                }
                sprintSelect.value = activeSprintId;
            }
            statuses.forEach(function (status) {
                const column = document.createElement("section"); column.className = "tasks-column tasks-column-" + status.id;
                const heading = document.createElement("header"); heading.className = "tasks-column-heading";
                const title = document.createElement("h2"); title.textContent = status.label; const count = document.createElement("span");
                const tasks = rows.filter(function (task) {
                    if (!activeSprintId || String(task.sprint_id || "") !== String(activeSprintId) || statusBucket(task.status) !== status.id) return false;
                    if (onlyMine && String(task.assigned_to || "") !== String(options.getUserId ? options.getUserId() : "")) return false;
                    return !query || [task.title, descriptionState(task).text, memberName(task.assigned_to)].join(" ").toLocaleLowerCase().includes(query);
                });
                count.textContent = String(tasks.length); heading.append(title, count); column.append(heading);
                column.dataset.dropStatus = status.id; column.classList.add("tasks-dropzone");
                if (!tasks.length) { const empty = document.createElement("p"); empty.className = "tasks-column-empty"; empty.textContent = "Nenhuma tarefa"; column.append(empty); }
                tasks.forEach(function (task) {
                    const card = document.createElement("article"); card.className = "task-card"; card.tabIndex = 0; card.setAttribute("role", "button"); card.dataset.taskOpen = task.id; card.draggable = true; card.dataset.dragTask = task.id;
                    const title = document.createElement("strong"); title.textContent = task.title || "Tarefa sem título"; card.append(title);
                    const meta = document.createElement("div"); meta.className = "task-card-meta";
                    const assignee = document.createElement("span"); assignee.textContent = "◎ " + memberName(task.assigned_to); meta.append(assignee);
                    const desc = descriptionState(task);
                    const priority = document.createElement("span"); priority.className = "task-priority-chip"; priority.textContent = priorityLabel(desc.priority || task.priority); meta.append(priority);
                    if (desc.due_date) { const due = document.createElement("span"); due.textContent = "Prazo " + formatDate(desc.due_date); meta.append(due); }
                    const criteria = acceptanceCriteria(task);
                    if (criteria.length) { const approved = criteria.filter(function (item) { return Boolean(item.approved_at && item.approved_by); }).length; const acceptance = document.createElement("span"); acceptance.className = "task-acceptance-progress"; acceptance.textContent = approved + "/" + criteria.length + " critérios aprovados"; meta.append(acceptance); }
                    card.append(meta); column.append(card);
                });
                board.append(column);
            });
        }
        function render() {
            renderSprints(); renderBacklog(); renderBoard();
        }
        let draggingTaskId = ""; let draggingSprintId = ""; let dropPlaceholder = null;
        function clearDrop() { root.querySelectorAll(".is-drop-target").forEach(function (node) { node.classList.remove("is-drop-target"); }); if (dropPlaceholder) dropPlaceholder.remove(); dropPlaceholder = null; }
        function placeholderFor(title, destination) { if (!dropPlaceholder) dropPlaceholder = document.createElement("div"); dropPlaceholder.className = "tasks-drop-placeholder"; dropPlaceholder.textContent = "“" + title + "” · " + destination; return dropPlaceholder; }
        root.addEventListener("dragstart", function (event) {
            const sprintHandle = event.target.closest("[data-sprint-drag]");
            if (sprintHandle) { draggingSprintId = sprintHandle.dataset.sprintDrag; event.dataTransfer.setData("text/plain", "sprint:" + draggingSprintId); event.dataTransfer.effectAllowed = "move"; return; }
            const task = event.target.closest("[data-drag-task]"); if (!task) return;
            draggingTaskId = task.dataset.dragTask; event.dataTransfer.setData("text/plain", draggingTaskId); event.dataTransfer.effectAllowed = "move";
        });
        root.addEventListener("dragover", function (event) {
            const sprintTarget = event.target.closest(".tasks-sprint-card");
            if (draggingSprintId && sprintTarget && String(sprintTarget.dataset.sprintId) !== String(draggingSprintId)) { event.preventDefault(); sprintTarget.classList.add("is-drop-target"); return; }
            const zone = event.target.closest("[data-drop-sprint], [data-drop-backlog], [data-drop-status]"); if (!zone || !draggingTaskId) return;
            event.preventDefault(); clearDrop(); zone.classList.add("is-drop-target");
            const task = taskFor(draggingTaskId); if (!task) return;
            const label = zone.dataset.dropSprint ? (sprints.find(function (s) { return String(s.id) === zone.dataset.dropSprint; }) || {}).name || "Sprint" : zone.dataset.dropBacklog !== undefined ? "Backlog geral" : statuses.find(function (s) { return s.id === zone.dataset.dropStatus; }).label;
            const place = placeholderFor(task.title || "Tarefa", label); const sibling = event.target.closest("[data-drag-task]");
            if (sibling && sibling.parentElement === zone) { const rect = sibling.getBoundingClientRect(); zone.insertBefore(place, event.clientY > rect.top + rect.height / 2 ? sibling.nextSibling : sibling); }
            else zone.append(place);
        });
        root.addEventListener("dragleave", function (event) { if (!root.contains(event.relatedTarget)) clearDrop(); });
        root.addEventListener("drop", async function (event) {
            const sprintTarget = event.target.closest(".tasks-sprint-card");
            if (draggingSprintId && sprintTarget && String(sprintTarget.dataset.sprintId) !== String(draggingSprintId)) {
                event.preventDefault(); const dragged = sprints.find(function (s) { return String(s.id) === String(draggingSprintId); }); const target = sprints.find(function (s) { return String(s.id) === String(sprintTarget.dataset.sprintId); });
                const sorted = sprints.slice().sort(byOrder); sorted.splice(sorted.indexOf(dragged), 1); sorted.splice(sorted.indexOf(target), 0, dragged);
                try { await Promise.all(sorted.map(function (s, i) { return api.updateSprint(s.id, { sort_order: i + 1 }, projectId); })); await load(true); } catch (error) { message(statusNode, error.message || "Não foi possível reorganizar as sprints.", "error"); }
                draggingSprintId = ""; return;
            }
            const zone = event.target.closest("[data-drop-sprint], [data-drop-backlog], [data-drop-status]"); if (!zone || !draggingTaskId) return;
            event.preventDefault(); const task = taskFor(draggingTaskId); if (!task) return;
            let patch = {};
            if (zone.dataset.dropStatus) patch.status = zone.dataset.dropStatus;
            else patch.sprint_id = zone.dataset.dropSprint || null;
            const targetSprint = zone.dataset.dropSprint || (zone.dataset.dropStatus ? task.sprint_id || "" : "");
            const peers = orderedTasks(rows.filter(function (row) { return String(row.id) !== String(task.id) && String(row.sprint_id || "") === String(targetSprint); }));
            let index = dropPlaceholder ? Array.from(zone.children).indexOf(dropPlaceholder) : peers.length;
            if (zone.dataset.dropStatus) index = peers.length;
            index = Math.max(0, Math.min(index, peers.length));
            const targetPeers = orderedTasks(rows.filter(function (row) { return String(row.id) !== String(task.id) && String(row.sprint_id || "") === String(targetSprint); }));
            const targetIndex = zone.dataset.dropStatus ? targetPeers.length : Math.max(0, Math.min(index, targetPeers.length)); targetPeers.splice(targetIndex, 0, task);
            try { await Promise.all(targetPeers.map(function (row, i) { const rowPatch = row.id === task.id ? patch : {}; if (row.id === task.id || String(row.sprint_id || "") === String(targetSprint)) rowPatch.sort_order = i + 1; return api.update(row.id, rowPatch, projectId); })); await load(true); }
            catch (error) { message(statusNode, error.message || "Não foi possível mover a tarefa.", "error"); }
            clearDrop(); draggingTaskId = "";
        });
        root.addEventListener("dragend", function () { clearDrop(); draggingTaskId = ""; draggingSprintId = ""; });
        function fillDetail(task) {
            const desc = descriptionState(task);
            field("taskDetailsId").value = task.id;
            field("taskDetailsTitle").value = task.title || "";
            field("taskDetailsDescription").value = desc.text || "";
            field("taskDetailsStatus").value = statusBucket(task.status);
            const doneOption = field("taskDetailsStatus").querySelector('option[value="done"]');
            if (doneOption) doneOption.disabled = !canApproveTasks() || !allCriteriaApproved(task);
            populateMemberOptions(field("taskDetailsAssignee"), task.assigned_to);
            field("taskDetailsPriority").value = String(desc.priority || task.priority || "normal").toLowerCase();
            field("taskDetailsDueDate").value = desc.due_date || "";
            populateSprintOptions(field("taskDetailsSprint"), task.sprint_id);
            message(field("taskDetailsStatusMessage"), "", "");
            renderAcceptanceCriteria(task);
        }
        function renderAcceptanceCriteria(task) {
            const list = field("taskAcceptanceCriteria");
            if (!list) return;
            list.replaceChildren();
            const criteria = acceptanceCriteria(task);
            criteria.forEach(function (criterion, index) {
                const row = document.createElement("div"); row.className = "task-acceptance-row";
                const input = document.createElement("input"); input.type = "text"; input.maxLength = 500; input.value = criterion.text || ""; input.placeholder = "Descreva um critério verificável"; input.dataset.acceptanceText = String(index); input.required = true;
                const approval = document.createElement("span"); approval.className = "task-acceptance-approval";
                if (criterion.approved_at && criterion.approved_by) approval.textContent = "Aprovado por " + memberName(criterion.approved_by);
                else approval.textContent = "Aguardando aprovação da gestão";
                row.append(input, approval);
                if (canApproveTasks() && !(criterion.approved_at && criterion.approved_by)) {
                    const approve = document.createElement("button"); approve.type = "button"; approve.className = "row-button"; approve.textContent = "Aprovar"; approve.dataset.approveCriterion = String(index); approve.disabled = !String(criterion.text || "").trim(); row.append(approve);
                }
                const remove = document.createElement("button"); remove.type = "button"; remove.className = "tasks-criterion-remove"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remover critério"); remove.dataset.removeCriterion = String(index); row.append(remove);
                list.append(row);
            });
            const add = document.createElement("button"); add.type = "button"; add.className = "row-button"; add.textContent = "+ Adicionar critério"; add.dataset.addCriterion = ""; list.append(add);
            if (!criteria.length) { const hint = document.createElement("p"); hint.className = "tasks-acceptance-hint"; hint.textContent = "Adicione os critérios que precisam ser atendidos. A tarefa só poderá ser concluída depois que a gestão aprovar todos."; list.prepend(hint); }
        }
        function saveCriteria(task, nextCriteria) {
            return api.update(task.id, { acceptance_criteria: nextCriteria }, projectId).then(function () { return load(true); });
        }
        async function loadComments(taskId) {
            const list = field("taskCommentList"); const notice = field("taskCommentStatus");
            list.replaceChildren(); message(notice, "Carregando comentários…", "");
            try {
                const comments = await api.listComments(taskId);
                if (String(field("taskDetailsId").value) !== String(taskId)) return;
                if (!comments.length) { const empty = document.createElement("p"); empty.className = "tasks-empty-state"; empty.textContent = "Ainda não há comentários."; list.append(empty); }
                comments.forEach(function (comment) {
                    const item = document.createElement("article"); item.className = "tasks-comment";
                    const head = document.createElement("div"); const name = document.createElement("strong"); name.textContent = comment.user_name || "Membro da equipe"; const date = document.createElement("time"); date.textContent = formatDate(comment.created_at); head.append(name, date);
                    const body = document.createElement("p"); body.textContent = comment.content || ""; item.append(head, body); list.append(item);
                });
                message(notice, "", "");
            } catch (error) { message(notice, error.message || "Não foi possível carregar os comentários.", "error"); }
        }
        async function openDetails(task) {
            if (!task) return;
            const commentsContent = field("taskCommentsContent"); const commentsToggle = field("toggleTaskComments");
            const detailLayout = detailsDialog.querySelector(".tasks-detail-layout");
            if (commentsContent) commentsContent.hidden = true;
            if (commentsToggle) { commentsToggle.setAttribute("aria-expanded", "false"); commentsToggle.textContent = "Revelar"; }
            if (detailLayout) detailLayout.classList.add("is-comments-collapsed");
            fillDetail(task); showDialog(detailsDialog);
        }
        async function load(quiet) {
            if (!projectId) { rows = []; sprints = []; render(); message(statusNode, "Escolha um projeto no seletor lateral para ver as tarefas.", ""); return; }
            if (!quiet) message(statusNode, "Carregando tarefas…", "");
            const requestedProjectId = projectId;
            try {
                const result = await Promise.all([api.list(requestedProjectId), api.listSprints(requestedProjectId)]);
                if (String(requestedProjectId) !== String(projectId) || String(requestedProjectId) !== String(options.getProjectId())) return;
                rows = Array.isArray(result[0]) ? result[0] : []; sprints = Array.isArray(result[1]) ? result[1] : [];
                render(); message(statusNode, "Atualizado agora · " + (options.syncLabel || "sincronização automática ativa") + ".", "");
            } catch (error) { message(statusNode, error.message || "Não foi possível carregar tarefas e sprints.", "error"); }
        }
        function setProject(nextId) { projectId = nextId || ""; load(); }
        function startPolling() { stopPolling(); pollTimer = window.setInterval(function () { load(true); }, 12000); }
        function stopPolling() { if (pollTimer) window.clearInterval(pollTimer); pollTimer = null; }
        function openCreateTask() {
            createForm.reset(); populateMemberOptions(field("taskAssigneeInput"), ""); populateSprintOptions(field("taskSprintInput"), "");
            message(field("taskCreateStatus"), "", ""); showDialog(taskDialog);
        }

        root.querySelectorAll("[data-tasks-tab]").forEach(function (button) {
            button.addEventListener("click", function () {
                const selected = button.dataset.tasksTab;
                root.querySelectorAll("[data-tasks-tab]").forEach(function (tab) { const active = tab === button; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", active ? "true" : "false"); });
                root.querySelectorAll("[data-tasks-view]").forEach(function (view) { const active = view.dataset.tasksView === selected; view.hidden = !active; view.classList.toggle("is-active", active); });
            });
        });
        root.querySelectorAll("#openCreateTask, #openCreateTaskFromBoard").forEach(function (button) { button.addEventListener("click", openCreateTask); });
        root.addEventListener("click", function (event) {
            if (!event.target.closest("[data-create-sprint]")) return;
            sprintForm.reset(); message(field("sprintCreateStatus"), "", ""); showDialog(sprintDialog);
        });
        root.querySelectorAll("[data-close-task-modal]").forEach(function (button) { button.addEventListener("click", function () { closeDialog(button.closest("dialog")); }); });
        if (searchInput) searchInput.addEventListener("input", renderBoard);
        if (mineInput) mineInput.addEventListener("change", renderBoard);
        if (sprintSelect) sprintSelect.addEventListener("change", function () { activeSprintId = sprintSelect.value; renderBoard(); });
        root.addEventListener("click", async function (event) {
            const commentsToggle = event.target.closest("#toggleTaskComments");
            if (commentsToggle) {
                const content = field("taskCommentsContent"); const expanded = commentsToggle.getAttribute("aria-expanded") !== "true";
                commentsToggle.setAttribute("aria-expanded", expanded ? "true" : "false"); commentsToggle.textContent = expanded ? "Ocultar" : "Revelar";
                content.hidden = !expanded;
                detailsDialog.querySelector(".tasks-detail-layout").classList.toggle("is-comments-collapsed", !expanded);
                if (expanded) await loadComments(field("taskDetailsId").value);
                return;
            }
            const addCriterion = event.target.closest("[data-add-criterion]");
            if (addCriterion) {
                const task = taskFor(field("taskDetailsId").value); if (!task) return;
                const criteria = acceptanceCriteria(task).concat([{ id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text: "", approved_at: null, approved_by: null }]);
                try { await saveCriteria(task, criteria); fillDetail(taskFor(task.id)); } catch (error) { message(field("taskDetailsStatusMessage"), error.message || "Não foi possível salvar o critério.", "error"); }
                return;
            }
            const removeCriterion = event.target.closest("[data-remove-criterion]");
            if (removeCriterion) {
                const task = taskFor(field("taskDetailsId").value); if (!task) return;
                const criteria = acceptanceCriteria(task).filter(function (_, index) { return index !== Number(removeCriterion.dataset.removeCriterion); });
                try { await saveCriteria(task, criteria); fillDetail(taskFor(task.id)); } catch (error) { message(field("taskDetailsStatusMessage"), error.message || "Não foi possível remover o critério.", "error"); }
                return;
            }
            const approveCriterion = event.target.closest("[data-approve-criterion]");
            if (approveCriterion) {
                const task = taskFor(field("taskDetailsId").value); if (!task || !canApproveTasks()) return;
                const index = Number(approveCriterion.dataset.approveCriterion); const criteria = acceptanceCriteria(task).map(function (item, itemIndex) { return itemIndex === index ? Object.assign({}, item, { approved_at: new Date().toISOString(), approved_by: options.getUserId() }) : item; });
                try {
                    const complete = criteria.length > 0 && criteria.every(function (item) { return Boolean(item.approved_at && item.approved_by); });
                    await api.update(task.id, { acceptance_criteria: criteria, ...(complete ? { status: "done" } : {}) }, projectId);
                    await load(true); fillDetail(taskFor(task.id));
                    if (complete) message(field("taskDetailsStatusMessage"), "Critérios aprovados. Tarefa concluída.", "success");
                } catch (error) { message(field("taskDetailsStatusMessage"), error.message || "Não foi possível aprovar o critério.", "error"); }
                return;
            }
            const completeSprint = event.target.closest("[data-complete-sprint]");
            if (completeSprint) {
                event.preventDefault(); event.stopPropagation();
                const sprint = sprints.find(function (item) { return String(item.id) === String(completeSprint.dataset.completeSprint); }); if (!sprint || isCompletedSprint(sprint)) return;
                const unfinished = rows.filter(function (task) { return String(task.sprint_id || "") === String(sprint.id) && statusBucket(task.status) !== "done"; });
                const completedTasks = rows.filter(function (task) { return String(task.sprint_id || "") === String(sprint.id) && statusBucket(task.status) === "done"; }).length;
                if (!window.confirm("Concluir “" + (sprint.name || "Sprint") + "”? " + completedTasks + " tarefa(s) concluída(s) ficam registradas nela; " + unfinished.length + " tarefa(s) não finalizadas voltam ao Backlog geral.")) return;
                completeSprint.disabled = true;
                try {
                    let nextOrder = rows.filter(function (task) { return !task.sprint_id; }).reduce(function (max, task) { return Math.max(max, Number(task.sort_order) || 0); }, 0);
                    for (const task of unfinished) { nextOrder += 1; await api.update(task.id, { sprint_id: null, sort_order: nextOrder }, projectId); }
                    await api.updateSprint(sprint.id, { status: "completed", completed_at: new Date().toISOString() }, projectId);
                    message(statusNode, "Sprint concluída. As tarefas pendentes voltaram ao backlog e as finalizadas ficaram registradas.", "success"); await load(true);
                } catch (error) { completeSprint.disabled = false; message(statusNode, error.message || "Não foi possível concluir a sprint.", "error"); }
                return;
            }
            const deleteSprint = event.target.closest("[data-delete-sprint]");
            if (deleteSprint) {
                event.preventDefault(); event.stopPropagation();
                const sprint = sprints.find(function (item) { return String(item.id) === String(deleteSprint.dataset.deleteSprint); }); if (!sprint) return;
                const taskCount = rows.filter(function (task) { return String(task.sprint_id || "") === String(sprint.id); }).length;
                if (!window.confirm("Excluir a sprint “" + (sprint.name || "Sprint") + "”? " + taskCount + " tarefa(s) serão movidas para o Backlog geral.")) return;
                deleteSprint.disabled = true;
                try { await api.moveSprintTasksToBacklog(sprint.id, projectId); await api.deleteSprint(sprint.id, projectId); message(statusNode, "Sprint excluída; as tarefas voltaram ao backlog.", "success"); await load(true); }
                catch (error) { deleteSprint.disabled = false; message(statusNode, error.message || "Não foi possível excluir a sprint.", "error"); }
                return;
            }
            const deleteTask = event.target.closest("#deleteTaskButton");
            if (deleteTask) {
                const task = taskFor(field("taskDetailsId").value); if (!task) return;
                if (!window.confirm("Excluir a tarefa “" + (task.title || "Tarefa") + "”? Essa ação não pode ser desfeita.")) return;
                deleteTask.disabled = true;
                try { await api.deleteTask(task.id, projectId); closeDialog(detailsDialog); message(statusNode, "Tarefa excluída.", "success"); await load(true); }
                catch (error) { deleteTask.disabled = false; message(field("taskDetailsStatusMessage"), error.message || "Não foi possível excluir a tarefa.", "error"); }
            }
            const button = event.target.closest("[data-task-open]"); if (button) openDetails(taskFor(button.dataset.taskOpen));
        });
        root.addEventListener("keydown", function (event) {
            const card = event.target.closest(".task-card[data-task-open]");
            if (!card || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault(); openDetails(taskFor(card.dataset.taskOpen));
        });
        root.addEventListener("input", function (event) {
            const input = event.target.closest("[data-acceptance-text]"); if (!input) return;
            const task = taskFor(field("taskDetailsId").value); if (!task) return;
            const criteria = acceptanceCriteria(task).map(function (item, index) { return index === Number(input.dataset.acceptanceText) ? Object.assign({}, item, { text: input.value, approved_at: null, approved_by: null }) : item; });
            task.acceptance_criteria = criteria;
            const row = input.closest(".task-acceptance-row"); const approval = row && row.querySelector(".task-acceptance-approval");
            if (approval) approval.textContent = "Aguardando aprovação da gestão";
            if (row && canApproveTasks() && !row.querySelector("[data-approve-criterion]")) { const button = document.createElement("button"); button.type = "button"; button.className = "row-button"; button.textContent = "Aprovar"; button.dataset.approveCriterion = input.dataset.acceptanceText; row.insertBefore(button, row.querySelector(".tasks-criterion-remove")); }
            const approve = row && row.querySelector("[data-approve-criterion]"); if (approve) approve.disabled = !input.value.trim();
        });
        if (createForm) createForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const submit = createForm.querySelector("button[type=submit]"); submit.disabled = true;
            try {
                const description = { text: field("taskDescriptionInput").value.trim(), priority: field("taskPriorityInput").value, due_date: field("taskDueDateInput").value };
                const sprintId = field("taskSprintInput").value || null;
                const nextOrder = rows.filter(function (task) { return String(task.sprint_id || "") === String(sprintId || ""); }).reduce(function (max, task) { return Math.max(max, Number(task.sort_order) || 0); }, 0) + 1;
                const payload = { project_id: projectId, title: field("taskTitleInput").value.trim(), description: JSON.stringify(description), acceptance_criteria: [], status: "todo", sprint_id: sprintId, sort_order: nextOrder };
                if (field("taskAssigneeInput").value) payload.assigned_to = field("taskAssigneeInput").value;
                await api.create(payload); closeDialog(taskDialog); message(statusNode, "Tarefa criada.", "success"); await load(true);
            } catch (error) { message(field("taskCreateStatus"), error.message || "Não foi possível criar a tarefa.", "error"); }
            finally { submit.disabled = false; }
        });
        if (sprintForm) sprintForm.addEventListener("submit", async function (event) {
            event.preventDefault(); const submit = sprintForm.querySelector("button[type=submit]"); submit.disabled = true;
            try {
                const nextOrder = sprints.reduce(function (max, sprint) { return Math.max(max, Number(sprint.sort_order) || 0); }, 0) + 1;
                await api.createSprint({ project_id: projectId, name: field("sprintNameInput").value.trim(), goal: field("sprintGoalInput").value.trim(), start_date: field("sprintStartInput").value, end_date: field("sprintEndInput").value, status: "planned", sort_order: nextOrder });
                closeDialog(sprintDialog); message(statusNode, "Sprint criada.", "success"); await load(true);
            } catch (error) { message(field("sprintCreateStatus"), error.message || "Não foi possível criar a sprint.", "error"); }
            finally { submit.disabled = false; }
        });
        if (detailsForm) detailsForm.addEventListener("submit", async function (event) {
            event.preventDefault(); const task = taskFor(field("taskDetailsId").value); if (!task) return;
            const submit = detailsForm.querySelector("button[type=submit]"); submit.disabled = true;
            try {
                const desc = descriptionState(task); desc.text = field("taskDetailsDescription").value.trim(); desc.priority = field("taskDetailsPriority").value; desc.due_date = field("taskDetailsDueDate").value;
                const criteria = acceptanceCriteria(task).map(function (item, index) { const input = field("taskAcceptanceCriteria").querySelector('[data-acceptance-text="' + index + '"]'); const text = input ? input.value.trim() : String(item.text || ""); return Object.assign({}, item, { text: text, ...(text !== String(item.text || "") ? { approved_at: null, approved_by: null } : {}) }); });
                const nextStatus = field("taskDetailsStatus").value;
                if (nextStatus === "done" && (!canApproveTasks() || !criteria.length || !criteria.every(function (item) { return Boolean(item.approved_at && item.approved_by); }))) throw new Error("A gestão precisa aprovar todos os critérios antes de concluir a tarefa.");
                await api.update(task.id, { title: field("taskDetailsTitle").value.trim(), description: JSON.stringify(desc), acceptance_criteria: criteria, status: nextStatus, assigned_to: field("taskDetailsAssignee").value || null, sprint_id: field("taskDetailsSprint").value || null }, projectId);
                closeDialog(detailsDialog); message(statusNode, "Tarefa salva.", "success"); await load(true);
            } catch (error) { message(field("taskDetailsStatusMessage"), error.message || "Não foi possível salvar a tarefa.", "error"); }
            finally { submit.disabled = false; }
        });
        if (commentForm) commentForm.addEventListener("submit", async function (event) {
            event.preventDefault(); const taskId = field("taskDetailsId").value; const input = field("taskCommentInput");
            const submit = commentForm.querySelector("button[type=submit]"); submit.disabled = true;
            try {
                await api.createComment({ task_id: taskId, user_id: options.getUserId ? options.getUserId() : null, user_name: options.getUserName ? options.getUserName() : "Membro da equipe", content: input.value.trim() });
                input.value = ""; await loadComments(taskId);
            } catch (error) { message(field("taskCommentStatus"), error.message || "Não foi possível enviar o comentário.", "error"); }
            finally { submit.disabled = false; }
        });
        return { load: load, setProject: setProject, startPolling: startPolling, stopPolling: stopPolling };
    }
    window.HeartspaceTasks = { create: create };
}());
