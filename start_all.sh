#!/bin/bash

echo "Starting AisleIQ Services for Mobile/IP Testing..."

PROJECT_DIR=$PWD

# 1. Start Backend API (Added --host 0.0.0.0)
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR'/backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload\""

# 2. Start Dashboard
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR'/dashboard && npm run dev\""

# 3. Start Mobile App (Added --host)
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR'/mobile && npm run dev -- --host\""

# 4. Start Vision System
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR'/vision && source venv/bin/activate && python3 main.py\""

echo "Done! Use your laptop IP to access the Mobile App from your phone."