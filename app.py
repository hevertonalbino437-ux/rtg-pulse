import streamlit as st
import pandas as pd
import time

# Configuração da página
st.set_page_config(page_title="RTG Insight - Protocolo 2", layout="wide")

# Título e Seleção
st.title("🏗️ RTG Insight: Monitor de Degradação")
col1, col2 = st.columns(2)

with col1:
    rtg_id = st.selectbox("Selecione o Equipamento", ["RTG-042", "RTG-010", "RTG-015"])
    tipo_op = st.selectbox("Tipo de Operação", ["Pátio -> Caminhão", "Caminhão -> Pilha", "Giro de Quadra"])

# Lógica do Cronômetro
if 'start_time' not in st.session_state:
    st.session_state.start_time = None

if st.button("🟢 INICIAR CRONÔMETRO", use_container_width=True):
    st.session_state.start_time = time.time()
    st.rerun()

if st.session_state.start_time:
    tempo_atual = time.time() - st.session_state.start_time
    st.metric("Tempo de Ciclo Atual", f"{tempo_atual:.2f}s")
    
    if st.button("🔴 FINALIZAR E ANALISAR", use_container_width=True):
        # Simulação de análise de perda financeira
        perda = (tempo_atual * 0.15) * 1.5  # Cálculo fictício de impacto em $
        st.error(f"Degradação Detectada: Ciclo {tempo_atual:.2f}s")
        st.subheader(f"💰 Perda Estimada: ${perda:.2f}/hora")
        st.session_state.start_time = None

st.divider()

# Parte do Analytics (O que você viu nos prints)
st.subheader("📊 Analytics de Performance")
tab1, tab2 = st.tabs(["MPH Médio", "Status da Frota"])

with tab1:
    st.line_chart([22, 24, 21, 19, 15, 14]) # Exemplo de queda de performance
    st.caption("Evolução do MPH (Movimentos por Hora) nas últimas 6h")

with tab2:
    data = {
        "Equipamento": ["RTG-042", "RTG-010", "RTG-015"],
        "Status": ["⚠️ Degradação", "✅ Normal", "✅ Normal"],
        "Eficiência": ["85%", "98%", "96%"]
    }
    st.table(pd.DataFrame(data))

