# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-cookies/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

## Backend (Django) - Comandos de Inicio

Para iniciar el backend localmente o para compartirlo en tu red:

### Iniciar en Red Local (IP: 192.168.1.18)         
Ejecuta esto desde la terminal en la carpeta `AGS_SALES`:
```powershell
cd AGS_SALES
.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```
*(O utilizando tu IP directamente: ``)*
.\venv\Scripts\python.exe manage.py runserver 192.168.1.18:8000# POS_AGS
