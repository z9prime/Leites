// --- CONFIGURAÇÃO SUPABASE ---
const supabaseUrl = 'https://euxfddzviktggfwefxhf.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eGZkZHp2aWt0Z2dmd2VmeGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTAwMzEsImV4cCI6MjA4MDY4NjAzMX0.oNfGbI8UaK9zUSLQkb5LfXRh8Ozhu-SNAeNaWYr7bS8';

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Variável global para guardar o valor atual do cofre
let currentVaultBalance = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
});

// --- FUNÇÃO PRINCIPAL ---
async function registerWin(vencedorKey) {
    // 1. INPUTS DE DINHEIRO (Aceita 0 se o outro tiver valor)
    // "investTotal" no HTML agora representa o dinheiro DO BOLSO (Externo)
    const dinheiroBolso = parseFloat(document.getElementById('investTotal').value) || 0;
    const dinheiroCofre = parseFloat(document.getElementById('investVault').value) || 0;
    
    // O valor real que vai ser apostado é a SOMA dos dois
    const totalEmJogo = dinheiroBolso + dinheiroCofre;

    // Inputs das Odds
    const oddHero = parseFloat(document.getElementById('oddHero').value);     
    const oddDraw = parseFloat(document.getElementById('oddDraw').value);     
    const oddBroWin = parseFloat(document.getElementById('oddBroWin').value); 

    // 2. VALIDAÇÕES DO ESPECIALISTA
    if (totalEmJogo <= 0) {
        alert("Erro: Precisas de meter dinheiro (do Bolso ou do Cofre) para jogar.");
        return;
    }

    if (!oddHero || !oddDraw || !oddBroWin) {
        alert("Faltam as Odds, mano.");
        return;
    }

    // Validação de Saldo do Cofre
    if (dinheiroCofre > 0) {
        if (dinheiroCofre > currentVaultBalance) {
            alert(`ERRO CRÍTICO: Cofre insuficiente! Só tens €${currentVaultBalance.toFixed(2)}.`);
            return;
        }
    }

    // --- PASSO 3: REGISTAR O SAQUE DO COFRE (Se usado) ---
    if (dinheiroCofre > 0) {
        const { error: errorSaque } = await supabaseClient.from('historico_operacoes').insert([{
            nome_jogo: "REINVESTIMENTO (SAQUE)",
            investimento_total: 0,
            vencedor: "SISTEMA",
            lucro_bruto: 0,
            valor_para_cofre: -dinheiroCofre, // Deduz do cofre
            valor_solidariedade: 0,
            lucro_liquido_vencedor: 0
        }]);
        
        if (errorSaque) {
            alert("Erro ao conectar ao cofre.");
            return;
        }
    }

    // --- PASSO 4: CALCULAR LUCROS (Baseado no Total em Jogo) ---
    
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

    // A Mágica Matemática
    const arbitragemIndex = (1/oddHero) + (1/oddDraw) + (1/oddBroWin);
    
    // Lucro Bruto usa o 'totalEmJogo' (Bolso + Cofre)
    let lucroBruto = (totalEmJogo / arbitragemIndex) - totalEmJogo;

    // Ajuste Ficção (Sempre positivo)
    if (lucroBruto < 0) lucroBruto = Math.abs(lucroBruto); 

    // Distribuição
    const valorCofre = lucroBruto * 0.20;
    const resto = lucroBruto - valorCofre;
    const solidariedade = resto * 0.30; 
    const lucroLiquido = resto - solidariedade;

    // Registar a Vitória
    const { error } = await supabaseClient.from('historico_operacoes').insert([{
        nome_jogo: "Op. Tática " + new Date().toLocaleTimeString(),
        investimento_total: totalEmJogo, // Grava o total real jogado
        vencedor: nomeVencedorDisplay,
        lucro_bruto: lucroBruto,
        valor_para_cofre: valorCofre,
        valor_solidariedade: solidariedade,
        lucro_liquido_vencedor: lucroLiquido
    }]);

    if (error) {
        console.error("Erro Supabase:", error);
    } else {
        // Limpar os campos de dinheiro para não repetir sem querer
        document.getElementById('investTotal').value = 0;
        document.getElementById('investVault').value = 0;
        loadStats(); 
    }
}

// --- CARREGAR DADOS ---
async function loadStats() {
    const { data, error } = await supabaseClient
        .from('historico_operacoes')
        .select('*')
        .order('data_operacao', { ascending: true });

    if (error || !data) return;

    let totalCofre = 0;
    let lucroSemana = 0;
    let lucroMes = 0;
    
    const agora = new Date();
    const umaSemanaAtras = new Date(); umaSemanaAtras.setDate(agora.getDate() - 7);
    const umMesAtras = new Date(); umMesAtras.setMonth(agora.getMonth() - 1);

    const labels = [];
    const values = [];

    const tbody = document.querySelector('#logsTable tbody');
    if(tbody) tbody.innerHTML = ''; 

    const dadosRecentes = [...data].reverse();

    data.forEach(op => {
        const dataOp = new Date(op.data_operacao);
        
        totalCofre += parseFloat(op.valor_para_cofre);
        
        // Ignora saques nos calculos de lucro da semana
        if (parseFloat(op.lucro_bruto) > 0) {
            if (dataOp >= umaSemanaAtras) lucroSemana += parseFloat(op.lucro_bruto);
            if (dataOp >= umMesAtras) lucroMes += parseFloat(op.lucro_bruto);
        }

        labels.push(dataOp.toLocaleDateString());
        values.push(totalCofre);
    });

    currentVaultBalance = totalCofre;

    if(tbody) {
        dadosRecentes.slice(0, 5).forEach(op => {
            const isSaque = parseFloat(op.valor_para_cofre) < 0;
            const corCofre = isSaque ? 'red' : 'var(--primary)';
            // Se for saque, mostra sinal negativo, senão positivo
            const sinal = isSaque ? '' : '+'; 

            const row = `<tr>
                <td>${new Date(op.data_operacao).toLocaleDateString()}</td>
                <td>${op.nome_jogo.includes('SAQUE') ? '⚠️ SAQUE' : op.vencedor}</td>
                <td style="color:${corCofre}">${sinal}${parseFloat(op.valor_para_cofre).toFixed(2)}</td>
                <td>${parseFloat(op.valor_solidariedade).toFixed(2)}</td>
                <td>${parseFloat(op.lucro_liquido_vencedor).toFixed(2)}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
    }

    const elSemana = document.getElementById('weeklyProfit');
    const elMes = document.getElementById('monthlyProfit');
    const elCofre = document.getElementById('totalVaultMini');

    if(elSemana) elSemana.innerText = `€ ${lucroSemana.toFixed(2)}`;
    if(elMes) elMes.innerText = `€ ${lucroMes.toFixed(2)}`;
    if(elCofre) {
        elCofre.innerText = `€ ${totalCofre.toFixed(2)}`;
        elCofre.style.color = totalCofre < 0 ? 'red' : 'var(--primary)';
    }

    if(document.getElementById('profitChart')) {
        renderChart(labels, values);
    }
}

// ChartJS mantém-se igual
let myChart = null;
function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Evolução Cofre',
                data: dataPoints,
                borderColor: '#00ff41',
                backgroundColor: 'rgba(0, 255, 65, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#333' }, ticks: { color: '#888' }, beginAtZero: true },
                x: { display: false }
            }
        }
    });
}
