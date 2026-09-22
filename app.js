// ============ Configuration ============
const API_BASE = 'http://localhost:8000/api';

// ============ State ============
let currentGoalId = null;
let currentTasks = [];
let currentFilter = 'all';

// ============ DOM Elements ============
const goalForm = document.getElementById('goalForm');
const goalInput = document.getElementById('goalInput');
const contextInput = document.getElementById('contextInput');
const deadlineInput = document.getElementById('deadlineInput');
const submitBtn = document.getElementById('submitBtn');
const resultsSection = document.getElementById('resultsSection');
const reasoningText = document.getElementById('reasoningText');
const taskList = document.getElementById('taskList');
const goalsHistory = document.getElementById('goalsHistory');
const taskModal = document.getElementById('taskModal');

// ============ Event Listeners ============
document.addEventListener('DOMContentLoaded', () => {
    loadGoalsHistory();
    setupFilterButtons();
    setupModal();
});

goalForm.addEventListener('submit', handleSubmit);

// ============ API Functions ============
async function createGoal(goalData) {
    const response = await fetch(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create goal');
    }
    
    return response.json();
}

async function fetchGoals() {
    const response = await fetch(`${API_BASE}/goals`);
    if (!response.ok) throw new Error('Failed to fetch goals');
    return response.json();
}

async function fetchGoal(goalId) {
    const response = await fetch(`${API_BASE}/goals/${goalId}`);
    if (!response.ok) throw new Error('Failed to fetch goal');
    return response.json();
}

async function deleteGoal(goalId) {
    const response = await fetch(`${API_BASE}/goals/${goalId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete goal');
}

async function updateTaskStatus(taskId, status) {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
}

// ============ Form Handling ============
async function handleSubmit(e) {
    e.preventDefault();
    
    const goal = goalInput.value.trim();
    const context = contextInput.value.trim();
    const deadlineDays = deadlineInput.value ? parseInt(deadlineInput.value) : null;
    
    if (!goal) return;
    
    setLoading(true);
    
    try {
        const result = await createGoal({
            goal,
            context: context || null,
            deadline_days: deadlineDays
        });
        
        displayResults(result);
        loadGoalsHistory();
        
        // Clear form
        goalForm.reset();
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    submitBtn.querySelector('.btn-loading').style.display = loading ? 'inline-flex' : 'none';
}

// ============ Display Functions ============
function displayResults(result) {
    currentGoalId = result.goal_id;
    currentTasks = result.tasks;
    
    // Show results section
    resultsSection.style.display = 'block';
    
    // Display reasoning
    reasoningText.textContent = result.reasoning;
    
    // Update stats
    document.getElementById('totalTasks').textContent = result.tasks.length;
    document.getElementById('totalHours').textContent = result.total_estimated_hours.toFixed(1);
    
    if (result.deadline) {
        const deadline = new Date(result.deadline);
        document.getElementById('deadline').textContent = deadline.toLocaleDateString();
    } else {
        document.getElementById('deadline').textContent = '-';
    }
    
    updateCompletionStats();
    
    // Display tasks
    renderTasks();
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function renderTasks() {
    const filteredTasks = filterTasks(currentTasks, currentFilter);
    
    if (filteredTasks.length === 0) {
        taskList.innerHTML = '<p class="empty-state">No tasks match the current filter.</p>';
        return;
    }
    
    taskList.innerHTML = filteredTasks.map(task => createTaskHTML(task)).join('');
    
    // Add event listeners
    taskList.querySelectorAll('.task-checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', handleTaskToggle);
    });
    
    taskList.querySelectorAll('.task-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.matches('input[type="checkbox"]')) {
                const taskId = parseInt(item.dataset.taskId);
                showTaskDetails(taskId);
            }
        });
    });
}

function createTaskHTML(task) {
    const isCompleted = task.status === 'completed';
    const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline';
    const dependencies = task.dependencies.length > 0 
        ? `Depends on: ${task.dependencies.join(', ')}` 
        : '';
    
    return `
        <div class="task-item priority-${task.priority} status-${task.status}" data-task-id="${task.id}">
            <div class="task-checkbox">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} data-task-id="${task.id}">
            </div>
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-description">${escapeHtml(task.description || '')}</div>
                <div class="task-meta">
                    <span class="priority-badge ${task.priority}">${task.priority}</span>
                    <span>⏱️ ${task.estimated_hours}h</span>
                    <span>📅 ${deadline}</span>
                    ${dependencies ? `<span>🔗 ${dependencies}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function filterTasks(tasks, filter) {
    if (filter === 'all') return tasks;
    return tasks.filter(task => task.status === filter);
}

async function handleTaskToggle(e) {
    const taskId = parseInt(e.target.dataset.taskId);
    const isChecked = e.target.checked;
    const newStatus = isChecked ? 'completed' : 'pending';
    
    try {
        const updatedTask = await updateTaskStatus(taskId, newStatus);
        
        // Update local state
        const taskIndex = currentTasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            currentTasks[taskIndex] = updatedTask;
        }
        
        renderTasks();
        updateCompletionStats();
        
    } catch (error) {
        alert(`Error: ${error.message}`);
        e.target.checked = !isChecked;  // Revert
    }
}

function updateCompletionStats() {
    const completed = currentTasks.filter(t => t.status === 'completed').length;
    const total = currentTasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('completion').textContent = `${percentage}%`;
}

// ============ Filter Buttons ============
function setupFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });
}

// ============ Goals History ============
async function loadGoalsHistory() {
    try {
        const goals = await fetchGoals();
        
        if (goals.length === 0) {
            goalsHistory.innerHTML = '<p class="empty-state">No previous goals yet.</p>';
            return;
        }
        
        goalsHistory.innerHTML = goals.map(goal => `
            <div class="history-item" data-goal-id="${goal.id}">
                <div class="history-item-content">
                    <h4>${escapeHtml(goal.goal_text.substring(0, 60))}${goal.goal_text.length > 60 ? '...' : ''}</h4>
                    <div class="history-item-meta">
                        ${goal.task_count} tasks • ${goal.completed_count} completed • 
                        ${new Date(goal.created_at).toLocaleDateString()}
                    </div>
                </div>
                <div class="history-item-actions">
                    <button class="btn-icon view" title="View" onclick="loadGoal(${goal.id})">👁️</button>
                    <button class="btn-icon delete" title="Delete" onclick="handleDeleteGoal(event, ${goal.id})">🗑️</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load goals:', error);
    }
}

async function loadGoal(goalId) {
    try {
        const goal = await fetchGoal(goalId);
        
        currentGoalId = goal.id;
        currentTasks = goal.tasks;
        
        // Update display
        resultsSection.style.display = 'block';
        reasoningText.textContent = 'Loaded from saved goals.';
        
        document.getElementById('totalTasks').textContent = goal.tasks.length;
        const totalHours = goal.tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        document.getElementById('totalHours').textContent = totalHours.toFixed(1);
        
        if (goal.deadline) {
            document.getElementById('deadline').textContent = new Date(goal.deadline).toLocaleDateString();
        } else {
            document.getElementById('deadline').textContent = '-';
        }
        
        updateCompletionStats();
        renderTasks();
        
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function handleDeleteGoal(e, goalId) {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this goal?')) return;
    
    try {
        await deleteGoal(goalId);
        loadGoalsHistory();
        
        if (currentGoalId === goalId) {
            resultsSection.style.display = 'none';
            currentGoalId = null;
            currentTasks = [];
        }
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ============ Modal ============
function setupModal() {
    const closeBtn = taskModal.querySelector('.close-btn');
    
    closeBtn.addEventListener('click', () => {
        taskModal.style.display = 'none';
    });
    
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            taskModal.style.display = 'none';
        }
    });
}

function showTaskDetails(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('modalTitle').textContent = task.title;
    document.getElementById('modalBody').innerHTML = `
        <p><strong>Description:</strong></p>
        <p>${escapeHtml(task.description || 'No description')}</p>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p><strong>Priority:</strong> <span class="priority-badge ${task.priority}">${task.priority}</span></p>
        <p><strong>Status:</strong> ${task.status.replace('_', ' ')}</p>
        <p><strong>Estimated Hours:</strong> ${task.estimated_hours}</p>
        <p><strong>Deadline:</strong> ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Not set'}</p>
        ${task.dependencies.length > 0 ? `<p><strong>Dependencies:</strong> Tasks ${task.dependencies.join(', ')}</p>` : ''}
    `;
    
    taskModal.style.display = 'flex';
}

// ============ Utilities ============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}