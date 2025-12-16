// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- GLOBAL STATE & CONFIG ---
 // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBWjXcKpBUCCU8ffsCP_MKfpgzeV3JuSzk",
    authDomain: "my-kanban-app-b5cf8.firebaseapp.com",
    projectId: "my-kanban-app-b5cf8",
    storageBucket: "my-kanban-app-b5cf8.firebasestorage.app",
    messagingSenderId: "345803427370",
    appId: "1:345803427370:web:068f29c19e740e01b6bd53",
    measurementId: "G-GVN73KHQ31"
  };
  const appId = 'default-kanban-app';
let app, auth, db;
let userId = null;
let currentBoardId = null;
let currentBoardData = null; 
let unsubscribeTasks = () => {};
let unsubscribeActivity = () => {};

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"];

const authView = document.getElementById('auth-view');
const boardSelectionView = document.getElementById('board-selection-view');
const kanbanView = document.getElementById('kanban-view');
const enterAppBtn = document.getElementById('enter-app-btn');
const createBoardBtn = document.getElementById('create-board-btn');
const joinBoardBtn = document.getElementById('join-board-btn');
const changeBoardBtn = document.getElementById('change-board-btn');
const boardContainer = document.getElementById('kanban-board-container');
const addTaskModal = document.getElementById('add-task-modal');
const addTaskForm = document.getElementById('add-task-form');
const cancelAddTaskBtn = document.getElementById('cancel-add-task');
const boardIdDisplay = document.getElementById('board-id-display');
const userIdDisplay = document.getElementById('user-id-display');
const notificationBtn = document.getElementById('show-notifications-btn');
const notificationPanel = document.getElementById('notification-panel');
const notificationDot = document.getElementById('notification-dot');
const notificationList = document.getElementById('notification-list');
const colorPicker = document.getElementById('task-color-picker');

const taskDetailsModal = document.getElementById('task-details-modal');
const taskDetailsForm = document.getElementById('task-details-form');
const detailsColorPicker = document.getElementById('details-task-color-picker');
const cancelEditBtn = document.getElementById('cancel-edit-task');
const deleteTaskBtn = document.getElementById('delete-task-btn');
const addSubtaskBtn = document.getElementById('add-subtask-btn');
const addAttachmentBtn = document.getElementById('add-attachment-btn');


async function initialize() {
    if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing.");
        enterAppBtn.textContent = "Configuration Error";
        return;
    }
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    setupAuthStateObserver();
}

// --- AUTHENTICATION ---
function setupAuthStateObserver() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("Authenticated User ID:", userId);
            userIdDisplay.textContent = userId;
            enterAppBtn.textContent = "Enter App";
            enterAppBtn.disabled = false;
        } else {
            console.log("No user signed in. Attempting anonymous sign-in.");
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
                enterAppBtn.textContent = "Authentication Failed";
            }
        }
    });
}

function showView(view) {
    authView.classList.add('hidden');
    boardSelectionView.classList.add('hidden');
    kanbanView.classList.add('hidden');
    view.classList.remove('hidden');
}

async function setupBoardView(boardId, boardData) {
    currentBoardId = boardId;
    currentBoardData = boardData;
    document.getElementById('board-name-header').textContent = boardData.name;
    boardIdDisplay.textContent = boardId;
    
    if (!currentBoardData.columns || currentBoardData.columns.length === 0) {
        currentBoardData.columns = DEFAULT_COLUMNS;
        const boardRef = doc(db, `artifacts/${appId}/public/data/boards`, boardId);
        await updateDoc(boardRef, { columns: DEFAULT_COLUMNS });
    }
    
    unsubscribeTasks();
    unsubscribeActivity();

    renderColumnsAndTasksContainer();
    listenForTasks(boardId);
    listenForActivity(boardId);
    showView(kanbanView);
}

function renderColumnsAndTasksContainer() {
    boardContainer.innerHTML = '';
    currentBoardData.columns.forEach(columnName => {
        const columnId = columnName.replace(/\s+/g, '-').toLowerCase();
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.innerHTML = `
            <h2 class="kanban-column-title">${columnName}</h2>
            <div class="kanban-tasks" id="tasks-${columnId}" data-column-id="${columnName}"></div>
            <button class="w-full mt-2 px-4 py-2 text-sm text-gray-600 hover:bg-black/10 rounded-md add-task-trigger transition-colors" data-column-name="${columnName}">+ Add Task</button>
        `;
        boardContainer.appendChild(columnEl);
    });

    const addColumnEl = document.createElement('div');
    addColumnEl.className = 'flex-shrink-0 w-80';
    addColumnEl.innerHTML = `
        <button id="add-column-btn" class="w-full h-16 bg-black/5 hover:bg-black/10 text-gray-700 font-medium rounded-2xl transition-colors">
            + Add Another Column
        </button>
    `;
    boardContainer.appendChild(addColumnEl);
    document.getElementById('add-column-btn').addEventListener('click', addColumn);

    setupDragAndDrop();
}

async function createBoard() {
    const boardNameInput = document.getElementById('new-board-name');
    const boardName = boardNameInput.value.trim();
    if (!boardName) {
        showToast("Please enter a board name.", "info");
        return;
    }

    try {
        const boardsCollection = collection(db, `artifacts/${appId}/public/data/boards`);
        const newBoardRef = await addDoc(boardsCollection, {
            name: boardName,
            ownerId: userId,
            members: [userId],
            createdAt: serverTimestamp(),
            columns: DEFAULT_COLUMNS, 
        });
        console.log("Board created with ID:", newBoardRef.id);
        setupBoardView(newBoardRef.id, { name: boardName, columns: DEFAULT_COLUMNS });
    } catch (error) {
        console.error("Error creating board:", error);
        showToast("Could not create board.", "error");
    }
}

async function joinBoard() {
    const boardIdInput = document.getElementById('join-board-id');
    const boardId = boardIdInput.value.trim();
    if (!boardId) {
        showToast("Please enter a board ID.", "info");
        return;
    }

    try {
        const boardRef = doc(db, `artifacts/${appId}/public/data/boards`, boardId);
        const boardSnap = await getDoc(boardRef);

        if (boardSnap.exists()) {
            const boardData = boardSnap.data();
            if (!boardData.members.includes(userId)) {
                await updateDoc(boardRef, {
                    members: [...boardData.members, userId]
                });
                logActivity(boardId, `User ${userId.substring(0,6)}... joined the board.`);
            }
            setupBoardView(boardId, boardData);
        } else {
            showToast("Board not found.", "error");
        }
    } catch (error) {
        console.error("Error joining board:", error);
        showToast("Could not join board.", "error");
    }
}

function listenForTasks(boardId) {
    const tasksCollection = collection(db, `artifacts/${appId}/public/data/boards/${boardId}/tasks`);
    const q = query(tasksCollection); 

    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        const allTasks = {};
        currentBoardData.columns.forEach(col => allTasks[col] = []);

        let tasksForDueDateCheck = [];
        snapshot.docs.forEach(doc => {
            const task = { id: doc.id, ...doc.data() };
            if (task.status && allTasks[task.status]) {
                allTasks[task.status].push(task);
                tasksForDueDateCheck.push(task);
            }
        });
        
        document.querySelectorAll('.kanban-tasks').forEach(container => container.innerHTML = '');

        for (const column in allTasks) {
            allTasks[column].sort((a, b) => (a.order || 0) - (b.order || 0));
            allTasks[column].forEach(renderTask);
        }
        
        checkUpcomingDueDates(tasksForDueDateCheck);
    }, (error) => {
        console.error("Error listening for tasks:", error);
    });
}

function renderTask(taskData) {
    const columnId = taskData.status.replace(/\s+/g, '-').toLowerCase();
    const tasksContainer = document.getElementById(`tasks-${columnId}`);
    if (!tasksContainer) return;

    const existingTaskEl = document.getElementById(taskData.id);
    if (existingTaskEl) {
        
    }
    
    const taskEl = document.createElement('div');
    taskEl.id = taskData.id;
    taskEl.dataset.taskId = taskData.id; 
    taskEl.className = `kanban-task ${taskData.color ? 'color-' + taskData.color : 'color-gray'}`;
    taskEl.draggable = true;

    let dueDateHtml = '';
    if (taskData.dueDate) {
        const date = new Date(taskData.dueDate + 'T00:00:00'); 
        const isPast = new Date(date) < new Date().setHours(0,0,0,0);
        dueDateHtml = `
            <span class="task-footer-icon ${isPast ? 'text-red-600' : ''}" title="Due Date">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" /></svg>
                ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
            </span>
        `;
    }

    const priority = taskData.priority || 'Medium';
    const priorityHtml = `
        <span class="priority-indicator priority-${priority.toLowerCase()}">
            ${priority}
        </span>`;
    
    const subtasks = taskData.subtasks || [];
    const completedSubtasks = subtasks.filter(st => st.completed).length;
    const subtasksHtml = subtasks.length > 0 ? `
        <span class="task-footer-icon" title="${completedSubtasks} of ${subtasks.length} subtasks completed">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>
            ${completedSubtasks}/${subtasks.length}
        </span>
    ` : '';
    const attachments = taskData.attachments || [];
    const attachmentsHtml = attachments.length > 0 ? `
         <span class="task-footer-icon" title="${attachments.length} attachments">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a3 3 0 10-6 0v4a3 3 0 106 0V7a1 1 0 10-2 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" /></svg>
             ${attachments.length}
         </span>
    `: '';

    const assigneeInfo = taskData.assignedTo ? `<div class="mt-2 text-xs text-gray-500">Assigned: <code class="bg-gray-100 p-1 rounded">${taskData.assignedTo.substring(0,6)}...</code></div>` : '';
    
    taskEl.innerHTML = `
        <h3 class="font-semibold text-gray-800">${taskData.title}</h3>
        <p class="my-1 text-sm text-gray-600">${taskData.description}</p>
        ${assigneeInfo}
        <div class="task-meta">
            <div class="flex gap-3">${priorityHtml}</div>
            <div class="flex gap-3 items-center">${dueDateHtml} ${subtasksHtml} ${attachmentsHtml}</div>
        </div>
    `;
    tasksContainer.appendChild(taskEl);
}

async function addTask(e, columnName = 'To Do') {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const assignee = document.getElementById('task-assignee').value.trim();
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.getElementById('task-priority').value;
    const selectedColorEl = colorPicker.querySelector('.color-dot.selected');
    const color = selectedColorEl ? selectedColorEl.dataset.color : 'gray';
    
    if (!title) return;
    
    const tasksCollection = collection(db, `artifacts/${appId}/public/data/boards/${currentBoardId}/tasks`);
    
    const columnId = columnName.replace(/\s+/g, '-').toLowerCase();
    const columnTasksContainer = document.querySelector(`#tasks-${columnId}`);
    const tasksInColumn = columnTasksContainer.querySelectorAll('.kanban-task').length;

    try {
        const newTask = {
            title,
            description,
            status: columnName,
            assignedTo: assignee || null,
            createdAt: serverTimestamp(),
            order: tasksInColumn, 
            color: color,
            dueDate: dueDate || null,
            priority: priority,
            subtasks: [],
            attachments: [],
            dueDateNotified: false
        };
        const docRef = await addDoc(tasksCollection, newTask);
        console.log("Task added with ID: ", docRef.id);
        logActivity(currentBoardId, `User ${userId.substring(0,6)}... created task "${title}"`);
        
        addTaskForm.reset();
        addTaskModal.classList.add('hidden');
    } catch (error) {
        console.error("Error adding task: ", error);
    }
}

async function updateTaskStatus(taskId, newStatus, newOrder) {
    const taskRef = doc(db, `artifacts/${appId}/public/data/boards/${currentBoardId}/tasks`, taskId);
    try {
        await updateDoc(taskRef, { 
            status: newStatus,
            order: newOrder
        });
         console.log(`Task ${taskId} moved to ${newStatus} at position ${newOrder}`);
         const taskSnap = await getDoc(taskRef);
         const taskTitle = taskSnap.exists() ? taskSnap.data().title : 'a task';
         logActivity(currentBoardId, `User ${userId.substring(0,6)}... moved "${taskTitle}" to ${newStatus}`);
    } catch (error) {
        console.error("Error updating task status: ", error);
    }
}

async function updateTaskDetails() {
    const taskId = document.getElementById('task-id-input').value;
    if (!taskId) return;

    const taskRef = doc(db, `artifacts/${appId}/public/data/boards/${currentBoardId}/tasks`, taskId);
    const oldTaskSnap = await getDoc(taskRef);
    const oldTaskData = oldTaskSnap.data();

    const updatedData = {
        title: document.getElementById('details-task-title').value.trim(),
        description: document.getElementById('details-task-desc').value.trim(),
        assignedTo: document.getElementById('details-task-assignee').value.trim() || null,
        dueDate: document.getElementById('details-task-due-date').value || null,
        priority: document.getElementById('details-task-priority').value,
        color: detailsColorPicker.querySelector('.selected')?.dataset.color || 'gray',
        subtasks: Array.from(document.querySelectorAll('#subtasks-list .subtask-item')).map(item => ({
            text: item.querySelector('.subtask-text').textContent,
            completed: item.querySelector('input[type="checkbox"]').checked
        })),
        attachments: Array.from(document.querySelectorAll('#attachments-list .attachment-item')).map(item => ({
            url: item.href,
            name: item.textContent
        }))
    };

    try {
        await updateDoc(taskRef, updatedData);
        logActivity(currentBoardId, `User ${userId.substring(0,6)}... updated task "${updatedData.title}"`);
        if (oldTaskData.assignedTo !== updatedData.assignedTo) {
            const assignee = updatedData.assignedTo ? `user ${updatedData.assignedTo.substring(0,6)}...` : 'unassigned';
            logActivity(currentBoardId, `Task "${updatedData.title}" was assigned to ${assignee}`);
        }
        taskDetailsModal.classList.add('hidden');
        showToast('Task updated successfully!');
    } catch (error) {
        console.error("Error updating task: ", error);
    }
}

async function deleteTask() {
    const taskId = document.getElementById('task-id-input').value;
    if (!taskId) return;

    if (confirm('Are you sure you want to delete this task?')) {
        const taskRef = doc(db, `artifacts/${appId}/public/data/boards/${currentBoardId}/tasks`, taskId);
        const taskSnap = await getDoc(taskRef);
        const taskTitle = taskSnap.exists() ? taskSnap.data().title : 'a task';
        try {
            await deleteDoc(taskRef);
            logActivity(currentBoardId, `User ${userId.substring(0,6)}... deleted task "${taskTitle}"`);
            taskDetailsModal.classList.add('hidden');
            showToast(`Task "${taskTitle}" deleted.`, 'info');
        } catch(error) {
            console.error("Error deleting task: ", error);
        }
    }
}

async function addColumn() {
    const newColumnName = prompt("Enter new column name:");
    if (!newColumnName || newColumnName.trim() === '') return;

    const newColumns = [...currentBoardData.columns, newColumnName.trim()];
    
    try {
         const boardRef = doc(db, `artifacts/${appId}/public/data/boards`, currentBoardId);
         await updateDoc(boardRef, { columns: newColumns });
         
         currentBoardData.columns = newColumns;
         renderColumnsAndTasksContainer();
         listenForTasks(currentBoardId);
         logActivity(currentBoardId, `User ${userId.substring(0,6)}... added column "${newColumnName.trim()}"`);

    } catch (error) {
        console.error("Error adding new column:", error);
        showToast("Failed to add column.", "error");
    }
}

function listenForActivity(boardId) {
    const activityCollection = collection(db, `artifacts/${appId}/public/data/boards/${boardId}/activity`);
    const q = query(activityCollection, orderBy('timestamp', 'desc'));

    unsubscribeActivity = onSnapshot(q, (snapshot) => {
        notificationList.innerHTML = '';
        if (snapshot.empty) {
             notificationList.innerHTML = `<p class="text-gray-500 text-sm">No recent activity.</p>`;
             return;
        }
        snapshot.docs.forEach(doc => {
            const activity = doc.data();
            const activityEl = document.createElement('div');
            activityEl.className = 'text-sm p-2 rounded hover:bg-gray-50';
            const time = activity.timestamp ? new Date(activity.timestamp.toDate()).toLocaleString() : 'just now';
            activityEl.innerHTML = `<p class="text-gray-700">${activity.text}</p><p class="text-xs text-gray-400">${time}</p>`;
            notificationList.appendChild(activityEl);
        });
        notificationDot.classList.remove('hidden');
    });
}

async function logActivity(boardId, text) {
    try {
        const activityCollection = collection(db, `artifacts/${appId}/public/data/boards/${boardId}/activity`);
        await addDoc(activityCollection, {
            text,
            timestamp: serverTimestamp(),
            userId: userId
        });
    } catch (error) {
        console.error("Error logging activity: ", error);
    }
}

async function checkUpcomingDueDates(tasks) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const task of tasks) {
        if (task.dueDate && !task.dueDateNotified) {
            const dueDate = new Date(task.dueDate + 'T00:00:00');
            if (dueDate <= tomorrow && dueDate >= now) {
                logActivity(currentBoardId, `Task "${task.title}" is due soon.`);
                const taskRef = doc(db, `artifacts/${appId}/public/data/boards/${currentBoardId}/tasks`, task.id);
                await updateDoc(taskRef, { dueDateNotified: true });
            }
        }
    }
}

function setupDragAndDrop() {
    let draggedItem = null;

    boardContainer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-task')) {
            draggedItem = e.target;
            setTimeout(() => {
                e.target.classList.add('dragging');
            }, 0);
        }
    });

    boardContainer.addEventListener('dragend', (e) => {
        if(draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });

    boardContainer.addEventListener('dragover', e => {
        e.preventDefault();
        const column = e.target.closest('.kanban-tasks');
        if (column) {
            if (!column.classList.contains('drag-over')) {
                document.querySelectorAll('.kanban-tasks.drag-over').forEach(c => c.classList.remove('drag-over'));
                column.classList.add('drag-over');
            }
        }
    });

    boardContainer.addEventListener('dragleave', e => {
         if (e.target.classList.contains('kanban-tasks')) {
              e.target.classList.remove('drag-over');
         }
    });
    
    boardContainer.addEventListener('drop', e => {
        e.preventDefault();
        document.querySelectorAll('.kanban-tasks.drag-over').forEach(c => c.classList.remove('drag-over'));
        const column = e.target.closest('.kanban-tasks');
        if (column && draggedItem) {
            const newStatus = column.dataset.columnId;
            const tasksInNewColumn = [...column.querySelectorAll('.kanban-task')];
            const dropTarget = e.target.closest('.kanban-task');
            let newOrder = tasksInNewColumn.length;
            
            if(dropTarget) {
                const targetIndex = tasksInNewColumn.findIndex(t => t.id === dropTarget.id);
                newOrder = targetIndex;
            }

            if(dropTarget) {
                 column.insertBefore(draggedItem, dropTarget);
            } else {
                 column.appendChild(draggedItem);
            }

            const updatedTasks = [...column.querySelectorAll('.kanban-task')];
            updatedTasks.forEach((task, index) => {
                 if(task.id === draggedItem.id) {
                     updateTaskStatus(task.id, newStatus, index);
                 } else {
                     updateTaskStatus(task.id, newStatus, index);
                 }
            });
        }
    });
}

enterAppBtn.addEventListener('click', () => {
    if (userId) showView(boardSelectionView);
});

createBoardBtn.addEventListener('click', createBoard);
joinBoardBtn.addEventListener('click', joinBoard);

changeBoardBtn.addEventListener('click', () => {
    currentBoardId = null;
    unsubscribeTasks();
    unsubscribeActivity();
    showView(boardSelectionView);
});

addTaskForm.addEventListener('submit', (e) => {
    const columnName = addTaskForm.dataset.columnName || currentBoardData.columns[0];
    addTask(e, columnName);
});
cancelAddTaskBtn.addEventListener('click', () => {
    addTaskForm.reset();
    const currentSelected = colorPicker.querySelector('.selected');
    if (currentSelected) currentSelected.classList.remove('selected');
    addTaskModal.classList.add('hidden');
});

boardContainer.addEventListener('click', e => {
    const taskCard = e.target.closest('.kanban-task');
    if (taskCard) {
        openTaskDetailsModal(taskCard.dataset.taskId);
        return;
    }

    if (e.target.classList.contains('add-task-trigger')) {
        const columnName = e.target.dataset.columnName;
        addTaskForm.dataset.columnName = columnName; 

        addTaskForm.reset();
        const currentSelected = colorPicker.querySelector('.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        const defaultColor = colorPicker.querySelector('[data-color="gray"]');
        if(defaultColor) defaultColor.classList.add('selected');
        document.getElementById('task-priority').value = 'Medium'; 
        addTaskModal.classList.remove('hidden');
    }
});

boardIdDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(currentBoardId).then(() => {
        showToast('Board ID copied to clipboard!');
    }, (err) => {
        console.error('Could not copy text: ', err);
    });
});

notificationBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationPanel.classList.toggle('hidden');
    notificationDot.classList.add('hidden');
});

document.addEventListener('click', (e) => {
    if (!notificationPanel.classList.contains('hidden') && !notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
         notificationPanel.classList.add('hidden');
    }
});

colorPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-dot')) {
        const currentSelected = colorPicker.querySelector('.selected');
        if (currentSelected) {
            currentSelected.classList.remove('selected');
        }
        e.target.classList.add('selected');
    }
});

async function openTaskDetailsModal(taskId) {
    const taskRef = doc(db, `artifacts/${appId}/public/data/boards/${currentBoardId}/tasks`, taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
        console.error("Task not found!");
        return;
    }
    const task = taskSnap.data();
    
    document.getElementById('task-id-input').value = taskId;
    document.getElementById('details-task-title').value = task.title;
    document.getElementById('details-task-desc').value = task.description || '';
    document.getElementById('details-task-assignee').value = task.assignedTo || '';
    document.getElementById('details-task-due-date').value = task.dueDate || '';
    document.getElementById('details-task-priority').value = task.priority || 'Medium';

    detailsColorPicker.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('selected', dot.dataset.color === (task.color || 'gray'));
    });

    const subtasksList = document.getElementById('subtasks-list');
    subtasksList.innerHTML = '';
    (task.subtasks || []).forEach((subtask, index) => {
        renderSubtask(subtask, index);
    });

     const attachmentsList = document.getElementById('attachments-list');
    attachmentsList.innerHTML = '';
    (task.attachments || []).forEach((attachment, index) => {
        renderAttachment(attachment, index);
    });

    taskDetailsModal.classList.remove('hidden');
}

function renderSubtask(subtask, index) {
    const subtasksList = document.getElementById('subtasks-list');
    const item = document.createElement('div');
    item.className = 'subtask-item flex items-center justify-between bg-black/5 p-2 rounded';
    item.dataset.index = index;
    item.innerHTML = `
        <div class="flex items-center gap-2">
            <input type="checkbox" ${subtask.completed ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
            <span class="subtask-text ${subtask.completed ? 'line-through text-gray-500' : ''}">${subtask.text}</span>
        </div>
        <button type="button" class="remove-subtask-btn text-gray-400 hover:text-red-500 font-bold text-lg leading-none">&times;</button>
    `;
    subtasksList.appendChild(item);
}

function renderAttachment(attachment, index) {
    const attachmentsList = document.getElementById('attachments-list');
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-black/5 p-2 rounded';
    item.dataset.index = index;
    item.innerHTML = `
        <a href="${attachment.url}" target="_blank" rel="noopener noreferrer" class="attachment-item text-indigo-600 hover:underline truncate">${attachment.name || attachment.url}</a>
        <button type="button" class="remove-attachment-btn text-gray-400 hover:text-red-500 font-bold text-lg leading-none">&times;</button>
    `;
    attachmentsList.appendChild(item);
}

taskDetailsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    updateTaskDetails();
});

cancelEditBtn.addEventListener('click', () => taskDetailsModal.classList.add('hidden'));
deleteTaskBtn.addEventListener('click', deleteTask);

addSubtaskBtn.addEventListener('click', () => {
    const input = document.getElementById('new-subtask-input');
    if(input.value.trim()){
        renderSubtask({ text: input.value.trim(), completed: false }, -1); 
        input.value = '';
    }
});

addAttachmentBtn.addEventListener('click', () => {
    const input = document.getElementById('new-attachment-url');
    if(input.value.trim() && input.checkValidity()){
         try {
              const url = new URL(input.value.trim());
              renderAttachment({ name: url.hostname, url: url.href }, -1);
              input.value = '';
         } catch (_) {
              showToast("Please enter a valid URL.", "error");
         }
    }
});

document.getElementById('subtasks-list').addEventListener('click', e => {
    if (e.target.classList.contains('remove-subtask-btn')) {
        e.target.closest('.subtask-item').remove();
    }
    if (e.target.type === 'checkbox') {
        const textSpan = e.target.nextElementSibling;
        textSpan.classList.toggle('line-through');
        textSpan.classList.toggle('text-gray-500');
    }
});

 document.getElementById('attachments-list').addEventListener('click', e => {
    if (e.target.classList.contains('remove-attachment-btn')) {
        e.target.closest('div').remove();
    }
});

detailsColorPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-dot')) {
        const currentSelected = detailsColorPicker.querySelector('.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        e.target.classList.add('selected');
    }
});

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon;
    if (type === 'success') {
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else if (type === 'error'){
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else { 
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    toast.addEventListener('animationend', (e) => {
        if (e.animationName === 'fadeOut') {
            toast.remove();
        }
    });
}


initialize();





