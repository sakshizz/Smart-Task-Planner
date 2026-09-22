# 🎯 Smart Task Planner

An AI-powered task planning system that breaks down goals into actionable tasks with timelines, dependencies, and priorities. Uses OpenRouter API for LLM access.

## ✨ Features

- **Goal Parsing**: Input any goal in natural language
- **AI Task Breakdown**: Uses LLM via OpenRouter to generate actionable tasks
- **Dependency Mapping**: Identifies task dependencies
- **Timeline Estimation**: Suggests realistic deadlines
- **Priority Assignment**: Categorizes tasks by importance
- **Persistent Storage**: SQLite database for task management
- **REST API**: Clean API design with FastAPI
- **Web Interface**: Simple frontend to interact with the planner

## 🏗️ Architecture
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Frontend │────▶│ FastAPI │────▶│ OpenRouter │
│ (HTML/JS) │ │ Backend │ │ API (LLMs) │
└─────────────────┘ └────────┬────────┘ └─────────────────┘
│
▼
┌─────────────────┐
│ SQLite │
│ Database │
└─────────────────┘



## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- OpenRouter API Key (get it from https://openrouter.ai/keys)

### Installation

```bash
# Clone the repository
git clone https://github.com/sakshizz/Smart-Task-Planner.git
cd Smart-Task-Planner

# Create virtual environment
python -m venv venv

# On Windows
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Add your OpenRouter API key to the .env file

# Run the application
uvicorn backend.main:app --reload
