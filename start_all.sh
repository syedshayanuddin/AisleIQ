#!/bin/bash

echo "Starting AisleIQ Services in new Terminal windows..."

# Get the absolute path of the current directory
PROJECT_DIR=$PWD

# 1. Start Backend API
osascript -e 'tell application "Terminal" to do script "cd '$PROJECT_DIR'/backend && source venv/bin/activate && uvicorn app.main:app --reload"'

# 2. Start Dashboard
osascript -e 'tell application "Terminal" to do script "cd '$PROJECT_DIR'/dashboard && npm run dev"'

# 3. Start Vision System (Camera will launch)
osascript -e 'tell application "Terminal" to do script "cd '$PROJECT_DIR'/vision && source venv/bin/activate && python main.py"'

echo "Done! You should see three new terminal windows running."
