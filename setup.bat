@echo off
echo 🚀 Setting up ALX Polly project...

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Copy environment file if it doesn't exist
if not exist .env.local (
    echo 📝 Creating .env.local file...
    copy .env.example .env.local
    echo ⚠️  Please update .env.local with your Supabase credentials
) else (
    echo ✅ .env.local already exists
)

REM Run type checking
echo 🔍 Running TypeScript type checking...
call npm run tsc

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update .env.local with your Supabase credentials
echo 2. Run 'npm run dev' to start the development server
echo 3. Open http://localhost:3000 in your browser
echo.
echo Happy coding! 🎉
pause