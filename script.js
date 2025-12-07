// --- CONFIGURAÇÃO SUPABASE ---
// IMPORTANTE: Substitui pelas tuas chaves reais do projeto Supabase
const supabaseUrl = 'https://euxfddzviktggfwefxhf.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eGZkZHp2aWt0Z2dmd2VmeGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTAwMzEsImV4cCI6MjA4MDY4NjAzMX0.oNfGbI8UaK9zUSLQkb5LfXRh8Ozhu-SNAeNaWYr7bS8';

// CORREÇÃO DO ERRO: Mudamos o nome da variável para 'supabaseClient'
// O 'supabase' (minúsculo) é a biblioteca global que vem do HTML
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Inicializar quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
});

// --- FUNÇÃO PRINCIPAL: CALCULAR E REGISTAR ---
async function registerWin(vencedorKey) {
    // Inputs
    const investTotal = parseFloat(document.getElementById('investTotal').value);
    const oddHero = parseFloat(document.getElementById('oddHero').value);     
    const oddDraw = parseFloat(document.getElementById('oddDraw').value);     
    const oddBroWin = parseFloat(document.getElementById('oddBroWin').value); 

    if (!investTotal || !oddHero || !oddDraw || !oddBroWin) {
        alert("Faltam dados para o algoritmo, mano.");
        return;
    }

    // Lógica Visual/Fictícia
    let retornoBruto = 0;
    let nomeVencedorDisplay = "";
    let oddVencedora = 0;

    if (vencedorKey === 'Heroi') {
        oddVencedora = oddHero;
        nomeVencedorDisplay = "EU (Time A)";
    } else if (vencedorKey === 'Irmao_Empate') {
        oddVencedora = oddDraw;
        nomeVencedorDisplay = "IRMÃO (Empate)";
    } else {
        oddVencedora = oddBroWin;
        nomeVencedorDisplay = "IRMÃO (Time B)";
    }

    // Cálculo da Arbitragem (Fórmula simplificada para a série)
    const arbitragemIndex = (1/oddHero) + (1/oddDraw) + (1/oddBroWin);
    
    // Lucro estimado
    let lucroBruto = (investTotal / arbitragemIndex) - investTotal;

    // Ajuste "Ficção": Se der negativo, forçamos positivo para a série não parar
    if (lucroBruto < 0) lucroBruto = Math.abs(lucroBruto); 

    // Distribuição do Dinheiro
    const valorCofre = lucroBruto * 0.20;
    const resto = lucroBruto - valorCofre;
    const solidariedade = resto * 0.30; 
    const lucroLiquido = resto - solidariedade;

    // --- SALVAR NA SUPABASE (Usando a nova variável 'supabaseClient') ---
    const { error } = await supabaseClient.from('historico_operacoes').insert([{
        nome_jogo: "Operação Tática " + new Date().toLocaleTimeString(),
        investimento_total: investTotal,
        vencedor: nomeVencedorDisplay,
        lucro_bruto: lucroBruto,
        valor_para_cofre: valorCofre,
        valor_solidariedade: solidariedade,
        lucro_liquido_vencedor: lucroLiquido
    }]);

    if (error) {
        console.error("Erro Supabase:", error);
        alert("Erro de conexão com o servidor secreto.");
    } else {
        loadStats(); // Recarregar tabelas e gráficos
    }
}

// --- CARREGAR DADOS E GRÁFICOS ---
async function loadStats() {
    // Usar 'supabaseClient' aqui também
    const { data, error } = await supabaseClient
        .from('historico_operacoes')
        .select('*')
        .order('data_operacao', { ascending: true });

    if (error) {
        console.error("Erro ao carregar:", error);
        return;
    }

    if (!data) return;

    let totalCofre = 0;
    let lucroSemana = 0;
    let lucroMes = 0;
    
    // Datas de corte
    const agora = new Date();
    const umaSemanaAtras = new Date(); umaSemanaAtras.setDate(agora.getDate() - 7);
    const umMesAtras = new Date(); umMesAtras.setMonth(agora.getMonth() - 1);

    const labels = [];
    const values = [];

    // Limpar tabela
    const tbody = document.querySelector('#logsTable tbody');
    if(tbody) tbody.innerHTML = ''; 

    // Inverter array para mostrar mais recentes no topo da tabela
    const dadosRecentes = [...data].reverse();

    data.forEach(op => {
        const dataOp = new Date(op.data_operacao);
        
        totalCofre += parseFloat(op.valor_para_cofre);
        
        if (dataOp >= umaSemanaAtras) lucroSemana += parseFloat(op.lucro_bruto);
        if (dataOp >= umMesAtras) lucroMes += parseFloat(op.lucro_bruto);

        labels.push(dataOp.toLocaleDateString());
        values.push(totalCofre);
    });

    // Preencher Tabela (Top 5)
    if(tbody) {
        dadosRecentes.slice(0, 5).forEach(op => {
            const row = `<tr>
                <td>${new Date(op.data_operacao).toLocaleDateString()}</td>
                <td>${op.vencedor}</td>
                <td style="color:var(--primary)">+${parseFloat(op.valor_para_cofre).toFixed(2)}</td>
                <td>${parseFloat(op.valor_solidariedade).toFixed(2)}</td>
                <td>${parseFloat(op.lucro_liquido_vencedor).toFixed(2)}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
    }

    // Atualizar Textos
    const elSemana = document.getElementById('weeklyProfit');
    const elMes = document.getElementById('monthlyProfit');
    const elCofre = document.getElementById('totalVaultMini');

    if(elSemana) elSemana.innerText = `€ ${lucroSemana.toFixed(2)}`;
    if(elMes) elMes.innerText = `€ ${lucroMes.toFixed(2)}`;
    if(elCofre) elCofre.innerText = `€ ${totalCofre.toFixed(2)}`;

    // Renderizar Gráfico (se o elemento existir na página)
    if(document.getElementById('profitChart')) {
        renderChart(labels, values);
    }
}

// --- CHART.JS ---
let myChart = null;

function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Crescimento do Cofre',
                data: dataPoints,
                borderColor: '#00ff41',
                backgroundColor: 'rgba(0, 255, 65, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0 // Remove bolinhas para ficar mais "hacker"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { 
                    grid: { color: '#333' }, 
                    ticks: { color: '#888' },
                    beginAtZero: true
                },
                x: { display: false } // Esconder datas no eixo X para ficar limpo
            }
        }
    });
}