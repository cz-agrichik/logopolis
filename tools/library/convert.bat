@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Двойной щелчок: показать книги и спросить, какую собрать. Из командной строки: convert.bat potter (или --all, --dict…)
if not "%~1"=="" goto run
python bookconverter.py
echo.
set "BOOK="
set /p "BOOK=Какую книгу собрать? Впиши id и нажми Enter (пусто — все книги): "
if "%BOOK%"=="" (python bookconverter.py --all) else (python bookconverter.py %BOOK%)
goto done
:run
python bookconverter.py %*
:done
echo.
pause
