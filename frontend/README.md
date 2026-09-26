# AI-Powered Diabetic Retinopathy Detection & Healthcare Assistant

## Frontend

This is the frontend of our Final Year Project, an AI-powered healthcare application for diabetic retinopathy screening and healthcare assistance.
The application is built with **React Native, Expo, Expo Router, and TypeScript**. It provides the user interface for uploading retinal images, viewing screening results, and interacting with the healthcare assistant.

## Features

- 🩺 **Diabetic Retinopathy Screening**
  - Select and preview retinal images
  - Submit images for AI-based analysis
  - View prediction results

- 💬 **Healthcare Assistant**
  - Ask health-related questions
  - Receive AI-generated responses
  - Simple conversational interface

- 📱 **Mobile-Friendly UI**
  - React Native based interface
  - Easy navigation using Expo Router
  - Reusable and consistent components

- 🔗 **Backend Integration**
  - REST API communication
  - Handles screening and assistant requests
  - Loading and error states

## Tech Stack

- **React Native** - Mobile application
- **Expo** - Development framework
- **Expo Router** - Navigation
- **TypeScript** - Type-safe development
- **FAST API** - Backend communication
- **ESLint** - Code quality
  
## Project Structure

frontend/
│
├── .vscode/          # VS Code configuration
├── app/              # Screens and Expo Router routes
├── assets/            # Images, icons and static files
├── components/        # Reusable UI components
├── constants/         # Shared application constants
├── hooks/             # Custom React hooks
├── scripts/           # Utility scripts
├── services/          # API and backend communication
├── types/             # TypeScript type definitions
│
├── .env               # Environment variables
├── app.json           # Expo configuration
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── eslint.config.js   # ESLint configuration

## Application Flow

### Retinopathy Screening

Select Image
     ↓
Preview Image
     ↓
Send to Backend
     ↓
AI/ML Processing
     ↓
Prediction Result
     ↓
Display Result

### Healthcare Assistant

User Question
     ↓
Frontend
     ↓
Backend API
     ↓
AI Assistant
     ↓
Response
     ↓
Display in Chat

## Installation

### 1. Clone the Repository

git clone https://github.com/Aima235/Final-year-Project.git
cd Final-year-Project/frontend

### 2. Install Dependencies

npm install

### 3. Configure Environment

Create a `.env` file inside the `frontend` folder:

EXPO_PUBLIC_API_URL=YOUR_BACKEND_API_URL

For example:
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
Use your computer's local IP when testing on a physical mobile device.

### 4. Start the Application

npx expo start
Run on Android:

npx expo start --android

Run on web:
npx expo start --web

If you face Metro cache issues:
npx expo start --clear



