# RTG Insight MVP

MVP para registrar ciclos operacionais de RTGs e detectar degradacao silenciosa de performance em equipamentos no Protocolo 2.

## Estrutura

- `backend/app/main.py`: API FastAPI com endpoints REST JSON.
- `backend/app/database.py`: inicializacao e conexao SQLite.
- `backend/app/repositories.py`: acesso a dados (maquinas e ciclos).
- `backend/app/services.py`: regra de negocio (media movel, alertas e perdas).
- `backend/app/logging_config.py`: logging de movimentacoes com timestamp, operador e maquina.
- `frontend/streamlit_app.py`: coleta mobile-friendly e dashboard de gestao.

## Como executar

1. Instale dependencias Python:
   - `pip install -r requirements.txt`
2. Suba o backend:
   - `uvicorn backend.app.main:app --reload --port 8000`
3. Em outro terminal, suba o frontend Streamlit:
   - `streamlit run frontend/streamlit_app.py`

## Regras implementadas

- Media movel dos ultimos 10 ciclos por RTG.
- Alerta: quando media movel atual > 15% da media historica da maquina.
- Status: `Degradacao de Performance Detectada`.
- Dashboard com MPH comparativo por RTG.
- Exportacao de relatorio Protocolo 2 em Excel e PDF, ordenado por maior perda financeira estimada por hora.
