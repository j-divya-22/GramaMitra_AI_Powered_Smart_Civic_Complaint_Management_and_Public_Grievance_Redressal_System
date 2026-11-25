# GramaMitra

**GitHub repository name:** `GramaMitra_AI_Powered_Smart_Civic_Complaint_Management_and_Public_Grievance_Redressal_System`
## Project Contributors

1. **J-Divya-22** – [GitHub Profile](https://github.com/j-divya-22)
2. **BHARATHI-2005** – [GitHub Profile](https://github.com/BHARATHI-2005)

Both contributors collaborated on the development of GramaMitra, an AI-Powered Smart Civic Complaint Management and Public Grievance Redressal System.

GramaMitra is a multilingual civic complaint platform. Citizens can prepare and track reports about local infrastructure and public-service issues. Administrators can manage complaints through the authenticated backend. The application combines a React web client, an Express API backed by MySQL, and Python AI endpoints for image classification and local language-model features.

## Architecture and main capabilities

```text
Browser (React + Vite :5173)
  ├── Express API (:5000) ── MySQL 8 (:3306)
  ├── CNN Flask service (:8000) ── MobileNetV3 .keras file
  └── LLM Flask service (:8001) ── Qwen3 GGUF file via llama.cpp
```

The AI entry point is `ai/main.py`. It starts **one mode per process**: CNN mode when `CNN_ENABLED=true`, or LLM mode when `CNN_ENABLED=false`. Run two separate Python processes/environments if both features are needed at once.

The citizen UI supports complaint drafting, photo evidence, location/map interactions, status views and multilingual browser-based speech features. API-backed authentication and administrator features use the backend. The backend contains routes for authentication, complaints, administration, AI integration, uploads, knowledge and rewards. Map tiles and address enrichment need internet access. Speech recognition/synthesis depends on browser and device support; it is not a project-hosted speech model.

The backend expects MySQL, stores uploaded evidence under `backend/uploads/complaints` by default, and stores relative image paths in the database. Do not commit real complaint uploads or database data.

## Prerequisites

- Windows 10/11 with PowerShell (commands below use PowerShell syntax); Python 3.11, Node.js 18 or newer, npm, and MySQL 8.
- MySQL Workbench or the MySQL command-line client (`mysql`) for database setup.
- Jupyter Notebook or JupyterLab to open notebooks locally. Google Colab is recommended for executing these two notebooks unchanged because their cells use Google Colab and Drive APIs.
- Internet access to install dependencies, download model files, use OpenStreetMap services, and (where applicable) browser speech services.
- Enough disk space for the Qwen GGUF model (about 2.4 GB) and Python packages. The model weights are not included in Git.

The installed virtual environments in the original development workspace use Python 3.11.18. Recreate environments; do not copy a virtual environment from another machine.

## 1. Clone the repository

The local project folder does not need to be renamed. Once this project is published, replace `<YOUR_GITHUB_USERNAME>` with the account or organization that owns the repository:

```powershell
git clone https://github.com/<YOUR_GITHUB_USERNAME>/GramaMitra_AI_Powered_Smart_Civic_Complaint_Management_and_Public_Grievance_Redressal_System.git
Set-Location .\GramaMitra_AI_Powered_Smart_Civic_Complaint_Management_and_Public_Grievance_Redressal_System
```

If you already have a clone, open that folder in VS Code and use `git pull` to get the latest README and notebook uploads.

## 2. Install Node.js dependencies

The backend and frontend each have a committed `package-lock.json`. Run `npm ci` in each project so npm uses the locked dependency versions:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

Do not run `npm run install:all` for a clean setup: the root script also invokes npm in `ai/`, but the AI service dependencies are Python packages and are installed from the requirements files below.

## 3. Create isolated Python environments

Use separate environments: TensorFlow/Keras for CNN, and `llama-cpp-python` for LLM. This prevents the TensorFlow versions in the different requirement files from being combined.

### CNN environment

```powershell
py -3.11 -m venv ai\.venv-cnn
.\ai\.venv-cnn\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ai\requirements-cnn.txt
deactivate
```

### LLM environment

```powershell
py -3.11 -m venv ai\.venv-llm
.\ai\.venv-llm\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ai\requirements-llm.txt
deactivate
```

If PowerShell prevents activation, allow it only for the current terminal session, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

In Command Prompt, the corresponding activation scripts are `ai\.venv-cnn\Scripts\activate.bat` and `ai\.venv-llm\Scripts\activate.bat`. On macOS/Linux, create the same environments with `python3.11 -m venv ai/.venv-cnn` or `ai/.venv-llm`, then activate with `source ai/.venv-cnn/bin/activate` or `source ai/.venv-llm/bin/activate`.

### TensorFlow/Keras compatibility

- The CNN environment uses `ai/requirements-cnn.txt` (`tensorflow==2.20.0`, `keras==3.13.2`, and a constrained NumPy version).
- The LLM environment uses `ai/requirements-llm.txt`; it does not install TensorFlow.
- Do **not** install `ai/requirements.txt` on top of either environment. It pins TensorFlow 2.15.0 and NumPy 1.26.0 while also combining the LLM dependency, so it conflicts with the dedicated CNN requirement set.
- Keep each terminal/kernel on its matching environment. If imports report a TensorFlow/Keras mismatch, activate the CNN environment and reinstall only `ai/requirements-cnn.txt` in that environment; do not upgrade Keras or TensorFlow independently.

The AI has no need for a third Node.js dependency installation. Its `package.json` contains convenience scripts, but direct Python commands below make the selected virtual environment explicit.

## 4. Open and run the model notebooks

Both notebooks are in the **repository root**, alongside this README:

- [GramaMitra_CNN_11_v3.ipynb](./GramaMitra_CNN_11_v3.ipynb) — prepares a v3 train/validation/test split from an existing Google Drive dataset, trains the MobileNetV3Large civic classifier, evaluates it, and saves the model and class metadata. It is a training notebook, not a downloader for a pre-trained GramaMitra `.keras` file. Keras may fetch the ImageNet base weights requested by `weights="imagenet"` if they are not cached.
- [GramaMitra_LLM_Only.ipynb](./GramaMitra_LLM_Only.ipynb) — downloads a Qwen3-4B-Instruct-2507 GGUF in Q4_K_M quantization from the Hugging Face repository `bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF`. It searches the repository for a matching GGUF and prefers a non-split file.

### Execution environment

These notebook files use `google.colab` imports, mount Google Drive, and (in the CNN notebook) use `google.colab.files.upload`. **They will not run unchanged in a local Jupyter Notebook or JupyterLab session.** The most direct way to execute the published notebooks unchanged is:

1. Open [Google Colab](https://colab.research.google.com/).
2. Choose **File → Open notebook → GitHub** and locate the repository and notebook, or upload the notebook file from the cloned project.
3. Connect a Colab runtime and run the cells in order. The LLM notebook installs `huggingface_hub` in its notebook cell. Review the notebook source and model license/terms before running downloads or training.

You can open the files in local Jupyter Notebook or JupyterLab to read them or make a separate working copy. From the project root, after installing the respective Jupyter application in the chosen Python environment, launch with:

```powershell
jupyter notebook GramaMitra_CNN_11_v3.ipynb
jupyter lab GramaMitra_LLM_Only.ipynb
```

For local execution, use a copy and replace the Google Colab Drive mount, `/content/drive` paths, and Colab file-upload calls with local paths and notebook-compatible file selection. Do not overwrite the published notebook. The CNN notebook expects an existing dataset at `Civic_AI_CNN/dataset/selected` (and checks `Civic_AI_CNN/dataset/raw`); it does not download that dataset. Its cells also import `matplotlib` and `sklearn`, which are not listed in `ai/requirements-cnn.txt`. The LLM notebook installs `huggingface_hub` in a notebook cell, but its Drive mount must still be adapted for local execution.

### Output files and application locations

The CNN notebook writes its outputs in Google Drive under:

```text
MyDrive/Civic_AI_CNN/final_model_v3_11/
  civic_mobilenet_v3_v3_11.keras
  class_metadata_v3.json
```

Copy the trained weights to `ai/cnn/civic_mobilenet_v3_v3_11.keras`. The application already contains `ai/cnn/class_metadata_v3.json`; if you use the notebook-generated metadata, place it at `ai/cnn/class_metadata_v3.json` as well. The model loader in `ai/cnn/model.py` uses those exact filenames by default.

The LLM notebook saves the selected GGUF under `MyDrive/CivicConnect_Models/LLM/`. Its exact downloaded repository filename is selected dynamically, so check the printed download filename. The application expects this exact path and filename:

```text
ai/llm/Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf
```

Copy the downloaded model there and, if its downloaded name differs, rename the copy to the expected filename. `ai/llm/service.py` uses this path by default. The notebook's optional ZIP output is not required by the application.

From the project root, verify the model files before starting their services:

```powershell
Test-Path .\ai\cnn\civic_mobilenet_v3_v3_11.keras
Test-Path .\ai\llm\Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf
```

The first check is for the CNN service; the second is for the LLM service. Each must print `True` before starting that service. The model weights are excluded by `.gitignore`, so they are downloaded or trained separately and are not part of a GitHub clone.

## 5. Configure local environment files

Copy the sanitized templates; edit the copies, not the `.example` files:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
Copy-Item ai\.env.example ai\.env
```

Set these backend values in `backend/.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for your local MySQL database. Replace the sample password; the backend intentionally refuses the placeholder.
- `JWT_SECRET` to a private, random value at least 32 characters long. Do not reuse a real account password.
- `ADMIN_REGISTRATION_INVITE_CODE` to a private random value if administrator registration is needed.
- Keep `FRONTEND_URL` and `CORS_ORIGIN` at `http://localhost:5173` for the local Vite server.
- Keep `AI_SERVICE_URL=http://localhost:8000` and `LLM_SERVICE_URL=http://localhost:8001` for the two local AI processes.

In `ai/.env`, the model paths are relative to the `ai` folder and match the expected locations above. Keep `CNN_ENABLED=true` for the CNN process; the LLM terminal will override this to `false` as shown below. The AI reads this file when started from the `ai` directory.

In `frontend/.env.local`, keep `VITE_API_BASE_URL=http://localhost:5000` and `VITE_AI_BASE_URL=http://localhost:8000`. Set `VITE_AUTH_MODE=api` to use backend authentication. If left unset, development can use browser-local demo authentication; demo reports and accounts stay in that browser and must not contain real or sensitive citizen data.

Never commit `backend/.env`, `frontend/.env.local`, or `ai/.env`. They contain machine-specific values and may contain secrets. The `.env.example` templates are safe configuration examples and should be committed.

## 6. Set up MySQL 8

The current backend uses MySQL. Use **only** [`backend/src/models/mysql_schema.sql`](./backend/src/models/mysql_schema.sql) for a fresh database: it creates `gramamitra_db` and the tables expected by the current backend, including the regional-insights and rewards tables.

The files `backend/src/models/schema.sql` (PostgreSQL) and `backend/src/models/schema.mysql.sql` (an older schema) are not the current backend schema. Do not import them for this setup.

1. Start MySQL 8 and connect as an administrator using MySQL Workbench or the `mysql` client.
2. Import the fresh-install schema from the repository root. In PowerShell, this invokes the MySQL client through `cmd.exe` so input redirection works:

   ```powershell
   cmd /c "mysql -u root -p < backend\src\models\mysql_schema.sql"
   ```

   Enter the MySQL administrator password when prompted. Alternatively, open `mysql_schema.sql` in MySQL Workbench and execute the script.
3. Create a dedicated application user (change the placeholder to a private password; do not paste it into a public issue or README):

   ```sql
   CREATE USER 'gramamitra_app'@'localhost' IDENTIFIED BY 'replace-with-a-private-password';
   GRANT ALL PRIVILEGES ON gramamitra_db.* TO 'gramamitra_app'@'localhost';
   ```

   If this account already exists, use your database administrator's normal password-update procedure instead of creating it again.
4. Put the same database name, user and password in `backend/.env`. The backend connects to MySQL during startup and exits if the connection fails.

### Existing databases and migrations

There is no automatic migration runner. The fresh-install `mysql_schema.sql` already contains the tables/columns represented by both migration scripts, so **do not run the migrations after importing that complete schema**.

For an existing older database that lacks these changes, back it up first and have a MySQL administrator apply the additive scripts in `backend/src/models/migrations/` to `gramamitra_db`:

```powershell
cmd /c "mysql -u root -p gramamitra_db < backend\src\models\migrations\20261123_regional_insights.sql"
cmd /c "mysql -u root -p gramamitra_db < backend\src\models\migrations\20261123_citizen_rewards.sql"
```

Do not apply these scripts blindly to an unrelated or differently-versioned schema; inspect the database and migration comments first.

## 7. Start the services

Start MySQL first. Then open four PowerShell terminals at the repository root. The CNN and LLM require separate processes because `ai/main.py` selects one mode at startup.

### Terminal A — CNN AI service (port 8000)

```powershell
.\ai\.venv-cnn\Scripts\Activate.ps1
$env:CNN_ENABLED = "true"
$env:PORT = "8000"
Set-Location .\ai
python main.py
```

### Terminal B — LLM AI service (port 8001)

```powershell
.\ai\.venv-llm\Scripts\Activate.ps1
$env:CNN_ENABLED = "false"
Set-Location .\ai
python main.py
```

The LLM service uses `LLM_PORT=8001` from `ai/.env`. It loads the local Qwen GGUF through `llama-cpp-python`; first startup can take time and needs sufficient memory.

### Terminal C — backend API (port 5000)

```powershell
npm --prefix backend run dev
```

The backend requires a reachable MySQL database and valid `backend/.env` before it starts.

### Terminal D — frontend (port 5173)

```powershell
npm --prefix frontend run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Keep all four terminals running while using the full application. Local defaults are: Vite `5173`, backend `5000`, CNN `8000`, LLM `8001`, MySQL `3306`.

Check service health from another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8001/health
Invoke-RestMethod http://localhost:5000/health
```

## Troubleshooting

- **Backend reports missing/placeholder database settings:** Check `backend/.env`, confirm MySQL is running on `DB_HOST:DB_PORT`, and replace `DB_PASSWORD=your-local-password`.
- **Backend refuses to start because of `JWT_SECRET`:** Set a private value of 32 or more characters in `backend/.env`.
- **CNN says its model is unavailable:** Check the exact `.keras` path, keep `CNN_ENABLED=true` in the CNN terminal, and use the `.venv-cnn` interpreter. Do not substitute the older v2 weights for the current default.
- **LLM says GGUF is unavailable:** Check the exact `.gguf` path, activate `.venv-llm`, and set `CNN_ENABLED=false` in that terminal.
- **TensorFlow/Keras import or compatibility error:** Verify the selected Python interpreter is `ai/.venv-cnn`; install only `ai/requirements-cnn.txt` there. Keep the LLM packages in `.venv-llm`.
- **`llama-cpp-python` installation fails:** Check the Python version and platform wheel availability for that package. Some systems need native C/C++ build tooling; the project does not provide a platform-specific wheel or build configuration.
- **Frontend cannot reach API/AI:** Confirm all services are running on the ports above and that the `VITE_*_URL` values in `frontend/.env.local` match. Restart Vite after changing Vite environment variables.
- **Authentication stays in demo mode:** Set `VITE_AUTH_MODE=api` in `frontend/.env.local`, restart Vite, and verify backend auth/database configuration.
- **Notebook link is missing or notebook has no kernel:** The owner must upload the notebook at the repository root; install/enable VS Code Python and Jupyter extensions and select the matching Python virtual environment.
- **Map tiles or address enrichment do not load:** Check internet access. Address lookup uses the configured Nominatim/OpenStreetMap provider; respect that provider's usage policy.

## GitHub preparation and files

The root `.gitignore` excludes local `.env` files (but explicitly allows `.env.example`), `node_modules`, Python virtual environments and caches, build/coverage output, runtime uploads, local database dumps, and model binaries such as `.keras` and `.gguf`. It does not contain a `*.ipynb` rule or rules for `GramaMitra_CNN_11_v3.ipynb` or `GramaMitra_LLM_Only.ipynb`; both root notebook files are intended for publication along with SQL schemas/migrations, manifests, lockfiles, requirements, source, and this README.

Commit source, tests, SQL schemas and migrations, dependency manifests and lockfiles, `.env.example` templates, and this README. Do not commit actual secrets, complaint evidence, locally generated data, downloaded model weights, or virtual environments. After publication, inspect the staged file list in VS Code Source Control before committing.

The repository is intended to be published under the exact name shown at the top. CNN and LLM model files must be downloaded separately using the reviewed notebooks and therefore do not require Git LFS while they remain excluded from Git.
