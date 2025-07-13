document.getElementById('prisonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        custodyStart: formData.get('custodyStart'),
        sentenceFinal: formData.get('sentenceFinal'),
        years: parseInt(formData.get('years')),
        months: parseInt(formData.get('months')),
        article: formData.get('article'),
        part: formData.get('part'),
        regime: formData.get('regime'),
        measures: []
    };

    const measureTypes = formData.getAll('measureType[]');
    const measureStarts = formData.getAll('measureStart[]');
    const measureEnds = formData.getAll('measureEnd[]');
    for (let i = 0; i < measureTypes.length; i++) {
        data.measures.push({
            type: measureTypes[i],
            start: measureStarts[i],
            end: measureEnds[i]
        });
    }

    // Запрос к GenAPI
    const prompt = `Для статьи ${data.article} часть ${data.part}, режима ${data.regime}, даты вступления приговора ${data.sentenceFinal}, верните JSON с долями срока для рубежей (УДО, перевод на общий режим, ПТР и др.) и коэффициентами зачёта для СИЗО, домашнего ареста, подписки по законам на тот момент.`;
    const apiResponse = await fetch('https://gen-api.ru/api/v1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'api_key = sk-SR2CgXUJnJ5hp8uApZFUzI9bPeeQSMFgfoPzmmJsRqWyAvXVI07mpXb7WB70' // Замените на ваш ключ
        },
        body: JSON.stringify({ prompt, response_format: 'json' })
    });
    const { milestones, coefficients } = await apiResponse.json();

    // Расчёты
    const sentenceDays = (data.years * 365) + (data.months * 30);
    let creditedDays = 0;
    data.measures.forEach(m => {
        const start = parseDate(m.start);
        const end = parseDate(m.end);
        const days = (end - start) / (1000 * 60 * 60 * 24);
        const coef = coefficients[m.type] || 1; // Коэффициент от API
        creditedDays += days * coef;
    });

    const sentenceFinalDate = parseDate(data.sentenceFinal);
    const remainingDays = sentenceDays - creditedDays;
    const releaseDate = new Date(sentenceFinalDate.getTime() + remainingDays * 24 * 60 * 60 * 1000);

    // Рубежи
    const currentDate = new Date();
    const milestonesDiv = document.getElementById('milestones');
    milestonesDiv.innerHTML = '';
    for (const [name, fraction] of Object.entries(milestones)) {
        const milestoneDays = fraction * sentenceDays - creditedDays;
        const milestoneDate = new Date(sentenceFinalDate.getTime() + milestoneDays * 24 * 60 * 60 * 1000);
        const daysLeft = Math.max(0, (milestoneDate - currentDate) / (1000 * 60 * 60 * 24));
        const progress = Math.min(100, ((currentDate - sentenceFinalDate) / (milestoneDate - sentenceFinalDate)) * 100);

        milestonesDiv.innerHTML += `
            <p><strong>${name}:</strong> ${milestoneDate.toLocaleDateString('ru-RU')} (${daysLeft.toFixed(0)} дней)</p>
            <div class="progress-bar"><div class="progress" style="width: ${progress}%"></div></div>
        `;
    }

    // Отображение результатов
    const daysLeftTotal = Math.max(0, (releaseDate - currentDate) / (1000 * 60 * 60 * 24));
    const progressTotal = Math.min(100, ((currentDate - sentenceFinalDate) / (releaseDate - sentenceFinalDate)) * 100);
    document.getElementById('releaseDate').textContent = releaseDate.toLocaleDateString('ru-RU');
    document.getElementById('timeLeft').textContent = `${daysLeftTotal.toFixed(0)} дней`;
    document.getElementById('results').style.display = 'block';
    document.getElementById('results').innerHTML += `
        <div class="progress-bar"><div class="progress" style="width: ${progressTotal}%"></div></div>
    `;

    // Ссылка для分享
    const urlParams = new URLSearchParams(data).toString();
    document.getElementById('shareLink').href = `${window.location.origin}?${urlParams}`;
});

document.getElementById('addMeasure').addEventListener('click', () => {
    const div = document.createElement('div');
    div.className = 'measure';
    div.innerHTML = `
        <select name="measureType[]">
            <option value="sizo">СИЗО</option>
            <option value="houseArrest">Домашний арест</option>
            <option value="bail">Подписка о невыезде</option>
        </select>
        <input type="text" name="measureStart[]" placeholder="дд.мм.гггг">
        <input type="text" name="measureEnd[]" placeholder="дд.мм.гггг">
    `;
    document.getElementById('measures').appendChild(div);
});

function parseDate(str) {
    const [day, month, year] = str.split('.');
    return new Date(year, month - 1, day);
}

// Заполнение формы из URL
window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of params) {
        const input = document.querySelector(`[name="${key}"]`);
        if (input) input.value = value;
    }
};
