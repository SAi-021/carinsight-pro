(Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned) ; (& g:\CarInsightPro\venv\Scripts\Activate.ps1)

venv start

cd backend
python -m uvicorn main:app --reload --port 8000  

open new termilnal

cd frontend
npm start

deactivate
