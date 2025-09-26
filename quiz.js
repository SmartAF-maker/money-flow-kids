/* ============================
   AI Agent — QUIZ (PL/EN + live switch)
   ============================ */
   // quiz.js
(function () {
  const out = document.getElementById('aiAgentOut');
  const startBtn = document.querySelector('[data-ai="start-quiz"]');
  if (!out || !startBtn) return;

  // ---------- LANG ----------
  function getLang() {
    const sel = document.getElementById('langSelect');
    const v = (sel && sel.value) ? sel.value : (document.documentElement.lang || 'en');
    return String(v).slice(0,2).toLowerCase(); // 'pl' / 'en'
  }
  const LBL = {
    homeTitle: {pl:'Quiz mode', en:'Quiz mode'},
    homeSub:   {pl:'Wybierz zestaw (10 zestawów × 20 pytań).', en:'Pick a set (10 sets × 20 questions).'},
    start:     {pl:'Start', en:'Start'},
    random:    {pl:'Losuj', en:'Random'},
    qOf:       {pl:'Pytanie', en:'Question'},
    skip:      {pl:'Pomiń', en:'Skip'},
    stop:      {pl:'Zakończ', en:'Finish'},
    score:     {pl:'Wynik', en:'Score'},
    again:     {pl:'Nowy quiz', en:'New quiz'},
    choose:    {pl:'Wybierz zestaw', en:'Choose set'},
    good:      {pl:'Dobrze! ', en:'Nice! '},
    almost:    {pl:'Prawie… ', en:'Almost… '},
    fb100:     {pl:'Perfekcyjnie! Jesteś mistrzem rynku 🏆', en:'Perfect! You’re a market pro 🏆'},
    fb80:      {pl:'Świetna robota! 💪', en:'Great job! 💪'},
    fb50:      {pl:'Dobrze! Ćwicz dalej 🙂', en:'Good! Keep practicing 🙂'},
    fb0:       {pl:'Spoko — spróbuj jeszcze raz!', en:'No worries — try again!'}
  };
  function t(k){ return LBL[k][S.lang] || LBL[k].en; }

  // ---------- helpers ----------
  const A = s => `A. ${s}`;
  const B = s => `B. ${s}`;
  const C = s => `C. ${s}`;
  const D = s => `D. ${s}`;

  // fabryka pytania PL/EN
  const mc2 = (qPL,qEN, chPL, chEN, a, exPL='', exEN='') =>
    ({ q:{pl:qPL,en:qEN}, choices:{pl:chPL,en:chEN}, a, explain:{pl:exPL,en:exEN} });

  function msgByPct(p){
    if (p===100) return t('fb100');
    if (p>=80)  return t('fb80');
    if (p>=50)  return t('fb50');
    return t('fb0');
  }

  // mini-template dla zadań liczbowych
  const fmt = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (_,k)=> String(vars[k] ?? ''));

  // ---------- BANKS (po 20 pytań) ----------
  // 1) App basics & jars
  function bankBasicsApp(lang){
    const Q = [
      mc2('Który słoik jest do długoterminowego odkładania?',
          'Which jar is for long-term saving?',
          [A('Savings'),B('Earnings'),C('Gifts')],[A('Savings'),B('Earnings'),C('Gifts')],0,'Savings = oszczędności.','Savings = money you keep.'),
      mc2('Z którego miejsca idą pieniądze na zakupy akcji lub walut?',
          'Where does the money for buying stocks/FX come from?',
          [A('Investment cash'),B('Savings'),C('Gifts')],[A('Investment cash'),B('Savings'),C('Gifts')],0,'Kupujemy z „Investment cash”.','We buy using “Investment cash”.'),
      mc2('Przycisk „Move Earnings → Savings” służy do…',
          'The “Move Earnings → Savings” button…',
          [A('przeniesienia kieszonkowego do oszczędności'),B('kupna akcji'),C('zmiany języka')],
          [A('moves pocket money to savings'),B('buys stocks'),C('changes language')],0),
      mc2('„Allowance 10 USD” dodaje środki do…',
          '“Allowance 10 USD” adds money to…',
          [A('Savings'),B('Gifts'),C('FX Portfolio')],[A('Savings'),B('Gifts'),C('FX Portfolio')],0),
      mc2('W „Parent panel” ustawiasz…',
          'In “Parent panel” you set…',
          [A('miesięczne kieszonkowe'),B('cenę akcji'),C('kurs walut')],
          [A('monthly allowance'),B('stock price'),C('FX rate')],0),
      mc2('„Net Worth” to…','“Net Worth” is…',
          [A('suma słoików + akcje + waluty'),B('tylko słoiki'),C('tylko akcje')],
          [A('jars + stocks + FX total'),B('jars only'),C('stocks only')],0),
      mc2('Szybkie sumy na górze to…','The small numbers on top are…',
          [A('mini słoiki'),B('tutorial'),C('watchlist')],
          [A('sticky mini-jars'),B('tutorial'),C('watchlist')],0),
      mc2('Watchlist służy do…','Watchlist is for…',
          [A('obserwowania instrumentów'),B('płatności'),C('zmiany PIN')],
          [A('tracking instruments'),B('payments'),C('PIN change')],0),
      mc2('„Basket (Stocks)” to…','“Basket (Stocks)” is…',
          [A('koszyk przed zakupem'),B('video'),C('chat')],
          [A('a pre-purchase basket'),B('video'),C('chat')],0),
      mc2('„Stock Portfolio” pokazuje…','“Stock Portfolio” shows…',
          [A('kupione akcje'),B('plan lekcji'),C('pulpit rodzica')],
          [A('your bought stocks'),B('timetable'),C('parent panel')],0),
      mc2('„FX Portfolio” pokazuje…','“FX Portfolio” shows…',
          [A('kupione waluty'),B('samouczek'),C('historię akcji')],
          [A('your bought currencies'),B('tutorial'),C('stock history')],0),
      mc2('Filtr „Max” w listach robi…','The “Max” filter does…',
          [A('pokazuje tylko tańsze/niższy kurs niż wpisany limit'),B('powiększa wykres'),C('zmienia język')],
          [A('shows items cheaper/lower than limit'),B('zooms chart'),C('changes language')],0),
      mc2('Przycisk sortowania ceny (↕) robi…','The sort price button (↕)…',
          [A('sortuje rosnąco/malejąco'),B('usuwa pozycje'),C('kupuje automatycznie')],
          [A('sorts up/down'),B('removes items'),C('auto-buys')],0),
      mc2('„Add to basket” przy transakcji…','“Add to basket” in trade…',
          [A('dodaje pozycję do koszyka'),B('sprzedaje'),C('zmienia region')],
          [A('adds the item to basket'),B('sells'),C('changes region')],0),
      mc2('„Buy (investment cash)” oznacza…','“Buy (investment cash)” means…',
          [A('zakup za środki inwestycyjne'),B('prezent'),C('nowy słoik')],
          [A('buy using investment cash'),B('a gift'),C('a new jar')],0),
      mc2('„Sales History” pokazuje…','“Sales History” shows…',
          [A('zrealizowane transakcje'),B('przyszłe ceny'),C('PIN')],
          [A('completed trades'),B('future prices'),C('PIN')],0),
      mc2('„Available Cash” to…','“Available Cash” is…',
          [A('Savings + Earnings + Gifts'),B('tylko Savings'),C('tylko Earnings')],
          [A('Savings + Earnings + Gifts'),B('Savings only'),C('Earnings only')],0),
      mc2('„Investments” (słoik) oznacza…','“Investments” (jar) means…',
          [A('gotówkę na inwestowanie'),B('prezenty'),C('wydatki szkolne')],
          [A('cash for investing'),B('gifts'),C('school spend')],0),
      mc2('Aby kupić akcje trzeba najpierw…','To buy stocks you first need…',
          [A('mieć środki w Investment cash'),B('YouTube'),C('tryb nocny')],
          [A('funds in Investment cash'),B('YouTube'),C('dark mode')],0),
      mc2('Watchlist kupuje sama?','Does watchlist auto-buy?',
          [A('Nie, to tylko obserwacja'),B('Tak'),C('Tylko w piątki')],
          [A('No, it’s only tracking'),B('Yes'),C('Only on Fridays')],0)
    ];
    return { id:'app-basics', title: (lang==='pl'?'App basics & słoiki':'App basics & jars'), questions:Q };
  }

  // 2) Stocks • easy math (generowane)
  function bankStocksMath(lang){
    const pairs = [[5,3],[7,2],[10,3],[12,2],[15,4],[8,5],[9,4],[20,2],[25,1],[6,6],[4,7],[3,8]];
    const pnl   = [[12,15],[9,7],[5,9],[20,18],[10,10],[7,11],[14,12],[3,5]];
    const Q = [];
    pairs.forEach(([p,q])=>{
      const cost=p*q;
      const qPL = fmt('Akcja kosztuje ${{p}}. Kupujesz {{q}} szt. Ile płacisz?',{p,q});
      const qEN = fmt('The share costs ${{p}}. You buy {{q}} pcs. How much do you pay?',{p,q});
      Q.push(mc2(qPL,qEN,[A(`$${cost}`),B(`$${p+q}`),C(`$${cost-1}`)],[A(`$${cost}`),B(`$${p+q}`),C(`$${cost-1}`)],0,'Koszt = cena × ilość.','Cost = price × quantity.'));
    });
    pnl.forEach(([buy,now])=>{
      const diff=now-buy, sign=diff>0?'+':'';
      const qPL = fmt('Kupiłeś po ${{b}}. Teraz ${{n}}. Jaki zysk/strata na 1 akcję?',{b:buy,n:now});
      const qEN = fmt('Bought at ${{b}}. Now ${{n}}. P/L per 1 share?',{b:buy,n:now});
      Q.push(mc2(qPL,qEN,[A(`${sign}$${Math.abs(diff)}`),B(`$${buy+now}`),C(`$${Math.abs(diff)+1}`)],[A(`${sign}$${Math.abs(diff)}`),B(`$${buy+now}`),C(`$${Math.abs(diff)+1}`)],0,'P/L = cena teraz − cena zakupu.','P/L = now − buy.'));
    });
    return { id:'stocks-math', title:(lang==='pl'?'Akcje • prosta matematyka':'Stocks • easy math'), questions:Q.slice(0,20) };
  }

  // 3) Stocks • concepts (20)
  function bankStockConcepts(lang){
    const Q = [
      mc2('„Ticker” to…','“Ticker” is…',
          [A('krótki symbol spółki, np. AAPL'),B('rodzaj wykresu'),C('konto rodzica')],
          [A('short company symbol, e.g., AAPL'),B('chart type'),C('parent account')],0),
      mc2('Jeśli linia wykresu rośnie w prawo, to zwykle…','If the chart line goes up to the right, usually…',
          [A('cena rośnie'),B('cena spada'),C('nie wiemy')],
          [A('price is rising'),B('price is falling'),C('we don’t know')],0),
      mc2('Kupując 1 akcję, stajesz się…','When you buy 1 share, you become…',
          [A('współwłaścicielem maleńkiej części firmy'),B('pracownikiem'),C('klientem banku')],
          [A('a tiny co-owner of the company'),B('an employee'),C('a bank client')],0),
      mc2('„Portfolio (Stocks)” to…','“Portfolio (Stocks)” is…',
          [A('Twoje kupione akcje'),B('lista życzeń'),C('film instruktażowy')],
          [A('your bought stocks'),B('wishlist'),C('tutorial video')],0),
      mc2('Czy cena akcji może się zmieniać codziennie?','Can a stock price change every day?',
          [A('Tak'),B('Nie'),C('Tylko w piątki')],
          [A('Yes'),B('No'),C('Only on Fridays')],0),
      mc2('Dywersyfikacja to…','Diversification is…',
          [A('posiadanie różnych spółek'),B('kupno tylko 1 spółki'),C('zmiana waluty')],
          [A('owning different companies'),B('only 1 company'),C('changing currency')],0),
      mc2('„Region” na liście rynku akcji wybiera…','“Region” on stocks list selects…',
          [A('USA/Europa/Chiny itd.'),B('kolor tła'),C('PIN')],
          [A('USA/Europe/China etc.'),B('background color'),C('PIN')],0),
      mc2('„Add to basket” przed „Buy” pomaga…','“Add to basket” before “Buy” helps…',
          [A('zaplanować zakup kilku pozycji'),B('zmienić język'),C('otworzyć tutorial')],
          [A('plan several items before buying'),B('change language'),C('open tutorial')],0),
      mc2('Wartość pozycji =','Position value =',
          [A('cena × liczba akcji'),B('cena + 1'),C('zawsze 10 USD')],
          [A('price × number of shares'),B('price + 1'),C('always 10 USD')],0),
      mc2('Gdy cena spada poniżej ceny zakupu, masz…','If price drops under buy price, you have…',
          [A('tymczasową stratę'),B('stałą wygraną'),C('gratisowe akcje')],
          [A('a temporary loss'),B('guaranteed win'),C('free shares')],0),
      mc2('„Sales History (Stocks)” to…','“Sales History (Stocks)” is…',
          [A('sprzedane transakcje'),B('lista filmów'),C('kursy walut')],
          [A('sold trades'),B('video list'),C('FX rates')],0),
      mc2('Czy możesz mieć 0 akcji danej spółki?','Can you have 0 shares of a company?',
          [A('Tak, po sprzedaży'),B('Nie'),C('Tylko w weekend')],
          [A('Yes, after selling'),B('No'),C('Only on weekends')],0),
      mc2('„Cancel” w oknie transakcji…','“Cancel” in trade window…',
          [A('zamyka okno bez zakupu'),B('sprzedaje akcje'),C('czyści słoiki')],
          [A('closes without buying'),B('sells stocks'),C('clears jars')],0),
      mc2('„Quantity” w transakcji oznacza…','“Quantity” in trade means…',
          [A('ile sztuk kupujesz'),B('cenę jednej akcji'),C('nr odcinka')],
          [A('how many shares you buy'),B('price per share'),C('episode number')],0),
      mc2('„Avg. cost” w portfelu to…','“Avg. cost” in portfolio is…',
          [A('średnia cena kupna akcji'),B('najwyższa cena dnia'),C('opłata bankowa')],
          [A('average buy price'),B('day high'),C('bank fee')],0),
      mc2('Jedna spółka może mieć różne ceny w różne dni?','Can one company have different prices on different days?',
          [A('Tak'),B('Nie'),C('Tylko w środy')],
          [A('Yes'),B('No'),C('Only on Wednesdays')],0),
      mc2('„Add more” na rynku akcji…','“Add more” on stock market…',
          [A('doładowuje listę popularnych spółek'),B('zmienia waluty'),C('otwiera Parent panel')],
          [A('adds popular stocks'),B('changes currencies'),C('opens Parent panel')],0),
      mc2('„Max price” filtr…','“Max price” filter…',
          [A('pokazuje spółki tańsze niż limit'),B('ustawia nową cenę spółki'),C('wycisza dźwięk')],
          [A('shows stocks cheaper than limit'),B('sets a new company price'),C('mutes sounds')],0),
      mc2('Warto mieć plan i budżet, bo…','It’s good to have a plan and budget because…',
          [A('rynek bywa zmienny'),B('pieniądze się nie kończą'),C('smok tak mówi')],
          [A('markets can be bumpy'),B('money never ends'),C('a dragon said so')],0),
      mc2('Długi horyzont (lata) zwykle…','A long horizon (years) usually…',
          [A('zmniejsza wpływ krótkich wahań'),B('powiększa każdy spadek'),C('blokuje kupowanie')],
          [A('reduces short-term noise'),B('amplifies every drop'),C('blocks buying')],0)
    ];
    return { id:'stocks-concepts', title:(lang==='pl'?'Akcje • pojęcia':'Stocks • concepts'), questions:Q };
  }

  // 4) Charts & ranges (20)
  function bankCharts(lang){
    const Q = [
      mc2('Zakres „1D” oznacza…','Range “1D” means…',[A('jeden dzień'),B('jeden miesiąc'),C('cały rok')],[A('one day'),B('one month'),C('full year')],0),
      mc2('„5D” to…','“5D” is…',[A('5 dni'),B('5 tygodni'),C('5 lat')],[A('5 days'),B('5 weeks'),C('5 years')],0),
      mc2('„1M” to…','“1M” is…',[A('1 miesiąc'),B('1 minuta'),C('1 milion')],[A('1 month'),B('1 minute'),C('1 million')],0),
      mc2('„6M” pokazuje…','“6M” shows…',[A('ostatnie 6 miesięcy'),B('6 dni'),C('6 lat')],[A('last 6 months'),B('6 days'),C('6 years')],0),
      mc2('„YTD” znaczy…','“YTD” means…',[A('od początku roku'),B('od wczoraj'),C('od 6 miesięcy')],[A('year-to-date (since Jan 1)'),B('since yesterday'),C('since 6 months')],0),
      mc2('„1Y” to…','“1Y” is…',[A('ostatni rok'),B('1 dzień'),C('1 miesiąc')],[A('last year'),B('1 day'),C('1 month')],0),
      mc2('Wykres idzie w dół →','Chart goes down →',[A('cena spadała'),B('cena rosła'),C('nic nie wiemy')],[A('price was falling'),B('price was rising'),C('no info')],0),
      mc2('Szybkie zmiany góra-dół to…','Fast up-down moves are…',[A('zmienność'),B('dywidenda'),C('podatek')],[A('volatility'),B('dividend'),C('tax')],0),
      mc2('Płaska linia to zwykle…','A flatter line usually means…',[A('mniejsze wahania'),B('większe wahania'),C('brak danych')],[A('smaller swings'),B('bigger swings'),C('no data')],0),
      mc2('Czy można przełączać zakresy?','Can you switch ranges?',[A('Tak, 1D/5D/…'),B('Nie'),C('Tylko w nocy')],[A('Yes, 1D/5D/…'),B('No'),C('Only at night')],0),
      mc2('Wzrost z 10 do 12 to…','Rise from 10 to 12 is…',[A('+2'),B('−2'),C('0')],[A('+2'),B('−2'),C('0')],0),
      mc2('Spadek z 8 do 6 to…','Drop from 8 to 6 is…',[A('−2'),B('+2'),C('0')],[A('−2'),B('+2'),C('0')],0),
      mc2('Wykres =','A chart is…',[A('historia ceny w czasie'),B('lista zakupów'),C('PIN rodzica')],[A('price over time'),B('shopping list'),C('parent PIN')],0),
      mc2('Przełączanie zakresu pomaga…','Changing the range helps…',[A('zobaczyć szerzej/ciaśniej'),B('zmienić walutę'),C('zmienić profil')],[A('zoom out/in'),B('change currency'),C('change profile')],0),
      mc2('Krótszy zakres (1D) pokazuje…','Short range (1D) shows…',[A('więcej szczegółów dnia'),B('wynik roczny'),C('listę życzeń')],[A('more day details'),B('year result'),C('wishlist')],0),
      mc2('Dłuższy zakres (1Y) pokazuje…','Long range (1Y) shows…',[A('trend w dłuższym czasie'),B('tylko dziś'),C('historia zakupów')],[A('long-term trend'),B('today only'),C('shop history')],0),
      mc2('Jeśli w „1Y” cena jest wyżej niż start…','If in “1Y” price is above start…',
          [A('był wzrost w roku'),B('na pewno strata'),C('zawsze 0')],
          [A('it grew this year'),B('sure loss'),C('always 0')],0),
      mc2('Nagły skok w górę to…','A sudden jump up is…',[A('duży wzrost szybko'),B('cisza'),C('zmiana języka')],[A('a big quick rise'),B('silence'),C('language change')],0),
      mc2('Zmiana zakresu nic nie kupuje — to…','Changing range doesn’t buy — it’s…',
          [A('tylko podgląd'),B('płatność'),C('koszyk')],
          [A('just a view'),B('payment'),C('basket')],0),
      mc2('Analiza wykresu + plan =','Chart + plan =',
          [A('mądrzejsze decyzje'),B('magia'),C('gratisy')],
          [A('smarter decisions'),B('magic'),C('freebies')],0)
    ];
    return { id:'charts', title:(lang==='pl'?'Wykresy i zakresy':'Charts & ranges'), questions:Q };
  }

  // 5) FX • basics (20, generowane + proste)
  function bankFXBasics(lang){
    const bases = [
      ['EUR/PLN','EUR'],['USD/PLN','USD'],['GBP/PLN','GBP'],
      ['USD/EUR','USD'],['CHF/PLN','CHF'],['EUR/USD','EUR'],
      ['JPY/PLN','JPY'],['AUD/USD','AUD'],['CAD/PLN','CAD'],['EUR/GBP','EUR']
    ];
    const strength = [
      {pair:'EUR/PLN',from:4.00,to:4.20,pl:'PLN słabszy',en:'PLN weaker'},
      {pair:'EUR/PLN',from:4.20,to:4.00,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'USD/PLN',from:3.90,to:4.10,pl:'PLN słabszy',en:'PLN weaker'},
      {pair:'USD/PLN',from:4.10,to:3.90,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'EUR/USD',from:1.05,to:1.10,pl:'EUR silniejszy',en:'EUR stronger'},
      {pair:'EUR/USD',from:1.10,to:1.05,pl:'EUR słabszy',en:'EUR weaker'},
      {pair:'GBP/PLN',from:5.00,to:4.80,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'GBP/PLN',from:4.80,to:5.00,pl:'PLN słabszy',en:'PLN weaker'},
      {pair:'CHF/PLN',from:4.40,to:4.20,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'CHF/PLN',from:4.20,to:4.40,pl:'PLN słabszy',en:'PLN weaker'}
    ];
    const Q=[];
    bases.forEach(([pair,base])=>{
      Q.push(mc2(
        `W parze ${pair} walutą bazową jest…`,
        `In pair ${pair} the base currency is…`,
        [A(base),B(pair.split('/')[1]),C('obie')],[A(base),B(pair.split('/')[1]),C('both')],0,
        'Pierwsza w parze = waluta bazowa.','First in pair = base currency.'
      ));
    });
    strength.forEach(s=>{
      Q.push(mc2(
        `${s.pair} zmienia się z ${s.from} → ${s.to}. Co to znaczy?`,
        `${s.pair} moves from ${s.from} → ${s.to}. What does it mean?`,
        [A(s.pl),B('nic to nie znaczy'),C('zmiana języka')],
        [A(s.en),B('means nothing'),C('language change')],0
      ));
    });
    return { id:'fx-basics', title:(lang==='pl'?'FX • podstawy':'FX • basics'), questions:Q };
  }

  // 6) FX • easy math (20)
  function bankFXMath(lang){
    const calc = [
      {pair:'EUR/PLN', rate:4.00, askPL:'Ile PLN za 5 EUR?', askEN:'How many PLN for 5 EUR?', ans:20, alt:[18,22]},
      {pair:'EUR/PLN', rate:4.20, askPL:'Ile PLN za 3 EUR?', askEN:'How many PLN for 3 EUR?', ans:12.6, alt:[11.4,13.2]},
      {pair:'USD/PLN', rate:4.00, askPL:'Ile PLN za 2 USD?', askEN:'How many PLN for 2 USD?', ans:8, alt:[6,10]},
      {pair:'USD/PLN', rate:3.90, askPL:'Ile PLN za 10 USD?',askEN:'How many PLN for 10 USD?', ans:39, alt:[40,35]},
      {pair:'GBP/PLN', rate:5.00, askPL:'Ile PLN za 1 GBP?', askEN:'How many PLN for 1 GBP?', ans:5, alt:[4,6]},
      {pair:'EUR/USD', rate:1.10, askPL:'Ile USD za 4 EUR?', askEN:'How many USD for 4 EUR?', ans:4.4, alt:[4.0,4.8]},
      {pair:'EUR/USD', rate:1.05, askPL:'Ile USD za 10 EUR?',askEN:'How many USD for 10 EUR?', ans:10.5, alt:[9.5,11]},
      {pair:'CHF/PLN', rate:4.20, askPL:'Ile PLN za 2 CHF?', askEN:'How many PLN for 2 CHF?', ans:8.4, alt:[8.2,8.8]},
      {pair:'JPY/PLN', rate:0.028,askPL:'Ile PLN za 100 JPY?',askEN:'How many PLN for 100 JPY?',ans:2.8, alt:[2.0,3.2]},
      {pair:'AUD/USD', rate:0.70, askPL:'Ile USD za 5 AUD?', askEN:'How many USD for 5 AUD?', ans:3.5, alt:[3.0,4.0]},
      {pair:'EUR/PLN', rate:4.00, askPL:'Ile EUR za 20 PLN?', askEN:'How many EUR for 20 PLN?', ans:5, alt:[4,6]},
      {pair:'USD/PLN', rate:4.00, askPL:'Ile USD za 12 PLN?', askEN:'How many USD for 12 PLN?', ans:3, alt:[2,4]},
      {pair:'EUR/USD', rate:1.10, askPL:'Ile EUR za 5.5 USD?',askEN:'How many EUR for 5.5 USD?',ans:5, alt:[4,6]},
      {pair:'GBP/PLN', rate:5.00, askPL:'Ile GBP za 25 PLN?',askEN:'How many GBP for 25 PLN?', ans:5, alt:[4,6]},
      {pair:'CHF/PLN', rate:4.00, askPL:'Ile CHF za 8 PLN?', askEN:'How many CHF for 8 PLN?', ans:2, alt:[1,3]},
      {pair:'CAD/PLN', rate:3.00, askPL:'Ile CAD za 9 PLN?', askEN:'How many CAD for 9 PLN?', ans:3, alt:[2,4]},
      {pair:'EUR/PLN', rate:4.50, askPL:'Ile PLN za 2 EUR?', askEN:'How many PLN for 2 EUR?', ans:9, alt:[8,10]},
      {pair:'USD/PLN', rate:4.20, askPL:'Ile PLN za 5 USD?', askEN:'How many PLN for 5 USD?', ans:21, alt:[20,22]},
      {pair:'EUR/USD', rate:1.20, askPL:'Ile USD za 1 EUR?', askEN:'How many USD for 1 EUR?', ans:1.2, alt:[1.1,1.3]},
      {pair:'EUR/GBP', rate:0.85, askPL:'Ile GBP za 2 EUR?', askEN:'How many GBP for 2 EUR?', ans:1.7, alt:[1.6,1.8]}
    ];
    const Q = calc.map(c => mc2(
      `${c.pair} = ${c.rate}. ${S.lang==='pl'?c.askPL:c.askEN}`,
      `${c.pair} = ${c.rate}. ${c.askEN}`,
      [A(String(c.ans)),B(String(c.alt[0])),C(String(c.alt[1]))],
      [A(String(c.ans)),B(String(c.alt[0])),C(String(c.alt[1]))],
      0,'Prosty mnożnik/dzielnik według kursu.','Multiply/divide by the rate.'
    ));
    return { id:'fx-math', title:(lang==='pl'?'FX • prosta matematyka':'FX • easy math'), questions:Q };
  }

  // 7) Risk & diversification
  function bankRisk(lang){
    const Q = [
      mc2('Rynek bywa…','Markets can be…',[A('zmienny'),B('zawsze stały'),C('nudny')],[A('volatile'),B('always fixed'),C('boring')],0),
      mc2('Dywersyfikacja zmniejsza ryzyko, bo…','Diversification lowers risk because…',
          [A('nie wszystko zależy od 1 spółki'),B('zawsze podwaja zysk'),C('blokuje zakupy')],
          [A('not all depends on 1 stock'),B('always doubles profit'),C('blocks buys')],0),
      mc2('Nie inwestujemy pieniędzy, które są…','Don’t invest money that is…',
          [A('potrzebne na ważne wydatki'),B('na prezent'),C('na zabawę')],
          [A('needed for important costs'),B('for gifts'),C('for toys')],0),
      mc2('Plan i budżet pomagają…','A plan and budget help…',
          [A('kontrolować ryzyko'),B('magicznie wygrywać'),C('wyłączyć internet')],
          [A('control risk'),B('win by magic'),C('turn off internet')],0),
      mc2('Krótkie skoki cen to…','Short price jumps are…',
          [A('normalne wahania'),B('błąd aplikacji'),C('zawsze panika')],
          [A('normal swings'),B('an app error'),C('always panic')],0),
      mc2('Emocje mogą…','Emotions can…',
          [A('psuć decyzje'),B('poprawiać kurs'),C('usuwać opłaty')],
          [A('hurt decisions'),B('fix prices'),C('remove fees')],0),
      mc2('Długi horyzont…','A long horizon…',
          [A('pomaga przeczekać wahania'),B('blokuje rezultaty'),C('zmienia walutę')],
          [A('helps ride out swings'),B('blocks results'),C('changes currency')],0),
      mc2('Małe kwoty na start to…','Small amounts to start are…',
          [A('bezpieczniejsze'),B('tajny cheat'),C('nowy PIN')],
          [A('safer'),B('a secret cheat'),C('a new PIN')],0),
      mc2('Czy zysk jest gwarantowany?','Is profit guaranteed?',
          [A('Nie'),B('Tak'),C('Tak, w środy')],
          [A('No'),B('Yes'),C('Yes, on Wednesdays')],0),
      mc2('Najważniejsze jest…','Most important is…',
          [A('rozumieć co kupujesz'),B('kopiować kolegę'),C('klikać losowo')],
          [A('understand what you buy'),B('copy a friend'),C('click random')],0),
      mc2('Zbyt piękne obietnice…','If it sounds too good…',
          [A('bądź ostrożny'),B('kup podwójnie'),C('sprzedaj słoiki')],
          [A('be careful'),B('buy double'),C('sell jars')],0),
      mc2('All-in w jedną rzecz to…','Going all-in on one thing is…',
          [A('duże ryzyko'),B('bez ryzyka'),C('wymóg aplikacji')],
          [A('high risk'),B('no risk'),C('an app rule')],0),
      mc2('Ucz się na małych kwotach, bo…','Learn with small amounts because…',
          [A('łatwiej naprawić błąd'),B('będzie nudno'),C('wykres nie działa')],
          [A('mistakes cost less'),B('it’s boring'),C('charts break')],0),
      mc2('Ryzyko i nagroda są…','Risk and reward are…',
          [A('często powiązane'),B('niezależne'),C('losowe')],
          [A('often linked'),B('independent'),C('random')],0),
      mc2('Paper trading pozwala…','Paper trading lets you…',
          [A('trenować bez prawdziwych pieniędzy'),B('zarobić odsetki'),C('zmienić PIN')],
          [A('practice without real money'),B('earn interest'),C('change PIN')],0),
      mc2('Cierpliwość w inwestowaniu jest…','Patience in investing is…',
          [A('bardzo ważna'),B('niepotrzebna'),C('zabroniona')],
          [A('very important'),B('useless'),C('forbidden')],0),
      mc2('Jeśli nie rozumiesz instrumentu…','If you don’t understand an asset…',
          [A('najpierw poznaj, nie kupuj'),B('kup dla testu'),C('proś o spoiler')],
          [A('learn first, don’t buy yet'),B('buy to test'),C('ask for spoiler')],0),
      mc2('Regularne przeglądy portfela…','Regular portfolio reviews…',
          [A('utrzymują porządek'),B('psują wyniki'),C('kasują historię')],
          [A('keep things tidy'),B('ruin results'),C('delete history')],0),
      mc2('Cele (np. „rower w wakacje”) pomagają…','Goals (e.g., “bike in summer”) help…',
          [A('trzymać plan'),B('przewidzieć przyszłość'),C('ominąć budżet')],
          [A('stick to the plan'),B('predict the future'),C('skip budget')],0),
      mc2('Nie ma wstydu w…','There’s no shame in…',
          [A('pytaniu i nauce'),B('udawaniu eksperta'),C('tajnym hazardzie')],
          [A('asking and learning'),B('pretending expert'),C('secret gambling')],0)
    ];
    return { id:'risk', title:(lang==='pl'?'Ryzyko i dywersyfikacja':'Risk & diversification'), questions:Q };
  }

  // 8) Watchlist & basket
  function bankWatchlistBasket(lang){
    const Q = [
      mc2('Watchlist to…','Watchlist is…',
          [A('lista obserwowanych'),B('historia sprzedaży'),C('PIN')],
          [A('your tracking list'),B('sales history'),C('PIN')],0),
      mc2('Do watchlisty dodajemy…','We add to watchlist…',
          [A('spółki i pary FX'),B('zdjęcia'),C('kontakty')],
          [A('stocks and FX pairs'),B('photos'),C('contacts')],0),
      mc2('Filtr „Stocks / Currencies / All” zmienia…','The “Stocks / Currencies / All” filter changes…',
          [A('co widzisz na liście'),B('język'),C('wysokość słoików')],
          [A('what you see on list'),B('language'),C('jar height')],0),
      mc2('Karta w watchliście pokazuje…','A watchlist card shows…',
          [A('cenę/kurs i szybkie info'),B('PIN'),C('regulamin')],
          [A('price/rate and quick info'),B('PIN'),C('rules')],0),
      mc2('Klik karty…','Clicking card…',
          [A('otwiera szczegóły + duży wykres'),B('kupuje'),C('zamyka appkę')],
          [A('opens details + big chart'),B('buys'),C('closes app')],0),
      mc2('Koszyk (Basket) służy do…','Basket is for…',
          [A('zbierania pozycji przed zakupem'),B('zmiany motywu'),C('czatu')],
          [A('collecting items before buy'),B('theme change'),C('chat')],0),
      mc2('„Add to basket”…','“Add to basket”…',
          [A('dodaje transakcję do koszyka'),B('usuwa watchlistę'),C('otwiera tutorial')],
          [A('adds the trade to basket'),B('deletes watchlist'),C('opens tutorial')],0),
      mc2('„Quantity” w koszyku to…','“Quantity” in basket is…',
          [A('ile sztuk/kwoty kupujesz'),B('jaki region'),C('który język')],
          [A('how many units you buy'),B('which region'),C('which language')],0),
      mc2('„Buy (investment cash)”…','“Buy (investment cash)”…',
          [A('kupuje za środki inwestycyjne'),B('sprzedaje wszystko'),C('zmienia PIN')],
          [A('buys using investment cash'),B('sells all'),C('changes PIN')],0),
      mc2('Koszyk FX i koszyk Akcji są…','FX and Stocks baskets are…',
          [A('oddzielne'),B('tym samym koszykiem'),C('ukryte')],
          [A('separate'),B('the same'),C('hidden')],0),
      mc2('Po zakupie pozycja…','After buying the item…',
          [A('znika z koszyka i trafia do portfela'),B('pojawia się w tutorialu'),C('znika z aplikacji')],
          [A('leaves basket and goes to portfolio'),B('goes to tutorial'),C('vanishes')],0),
      mc2('W koszyku widać…','In basket you see…',
          [A('sumę ilości i kwotę'),B('PIN'),C('tylko obrazek')],
          [A('total qty and amount'),B('PIN'),C('picture only')],0),
      mc2('Watchlist nie kupuje — to…','Watchlist doesn’t buy — it’s…',
          [A('tylko obserwacja'),B('magiczny sklep'),C('chat')],
          [A('just tracking'),B('magic shop'),C('chat')],0),
      mc2('Możesz mieć w koszyku…','You can have in basket…',
          [A('kilka różnych pozycji'),B('tylko jedną'),C('zero i nic więcej')],
          [A('several different items'),B('only one'),C('zero forever')],0),
      mc2('Usunięcie z koszyka…','Removing from basket…',
          [A('to nie sprzedaż z portfela'),B('kasuje portfel'),C('zmienia język')],
          [A('is not selling from portfolio'),B('deletes portfolio'),C('changes language')],0),
      mc2('„X” w oknach zwykle…','The “X” in dialogs usually…',
          [A('zamyka okno'),B('kupuje'),C('dodaje do watchlisty')],
          [A('closes the window'),B('buys'),C('adds to watchlist')],0),
      mc2('Gdy nie masz Investment cash…','If you have no Investment cash…',
          [A('nie kupisz — doładuj słoiki'),B('kupisz i tak'),C('appka płaci za Ciebie')],
          [A('you can’t buy — top up'),B('you still buy'),C('the app pays')],0),
      mc2('Sort w liście instrumentów pomaga…','Sorting the list helps…',
          [A('ułożyć wg ceny/kursu'),B('zmienić PIN'),C('otworzyć YouTube')],
          [A('order by price/rate'),B('change PIN'),C('open YouTube')],0),
      mc2('Wyszukiwarka (search) pozwala…','Search lets you…',
          [A('szybko znaleźć instrument'),B('zmienić region'),C('zmienić kolor')],
          [A('find an instrument fast'),B('change region'),C('change color')],0),
      mc2('To Ty decydujesz — appka…','You decide — the app…',
          [A('nic nie kupuje sama'),B('kupuje o północy'),C('pyta sąsiada')],
          [A('never buys by itself'),B('buys at midnight'),C('asks a neighbor')],0)
    ];
    return { id:'wl-basket', title:(lang==='pl'?'Watchlist i koszyk':'Watchlist & basket'), questions:Q };
  }

  // 9) P/L & averages
  function bankPnL(lang){
    const Q = [
      mc2('„Unrealized P/L” to…','“Unrealized P/L” is…',
          [A('wynik na pozycjach niesprzedanych'),B('wynik po sprzedaży'),C('opłata')],
          [A('result on not-sold positions'),B('after selling'),C('a fee')],0),
      mc2('„Realized P/L” to…','“Realized P/L” is…',
          [A('wynik po sprzedaży'),B('wynik na żywo'),C('kurs waluty')],
          [A('result after selling'),B('live only'),C('FX rate')],0),
      mc2('Średni koszt rośnie, gdy…','Average cost goes up when…',
          [A('dokupisz drożej'),B('nic nie robisz'),C('zmienisz język')],
          [A('you add at higher price'),B('you do nothing'),C('you change language')],0),
      mc2('Średni koszt spada, gdy…','Average cost drops when…',
          [A('dokupisz taniej'),B('kupisz drożej'),C('zjesz obiad')],
          [A('you add cheaper'),B('you buy higher'),C('you eat lunch')],0),
      mc2('P/L liczymy mniej więcej jako…','P/L is roughly…',
          [A('wartość teraz − koszt'),B('koszt − 1'),C('zawsze 0')],
          [A('value now − cost'),B('cost − 1'),C('always 0')],0),
      mc2('Net Worth to…','Net Worth is…',
          [A('słoiki + portfele'),B('tylko słoiki'),C('tylko FX')],
          [A('jars + portfolios'),B('jars only'),C('FX only')],0),
      mc2('Sprzedaż przenosi wynik do…','Selling moves result to…',
          [A('Realized P/L'),B('Unrealized P/L'),C('Tutorial')],
          [A('Realized P/L'),B('Unrealized P/L'),C('Tutorial')],0),
      mc2('Gdy cena = cena zakupu, P/L jest…','If price = buy price, P/L is…',
          [A('około 0'),B('+10'),C('−10')],[A('about 0'),B('+10'),C('−10')],0),
      mc2('Wartość pozycji akcji =','Stock position value =',
          [A('cena × liczba akcji'),B('cena + ilość'),C('ilość − 1')],
          [A('price × shares'),B('price + qty'),C('qty − 1')],0),
      mc2('Wartość pozycji FX liczona jest…','FX position value is…',
          [A('wg bieżącego kursu'),B('losowo'),C('1:1 zawsze')],
          [A('by current rate'),B('randomly'),C('always 1:1')],0),
      mc2('Historia sprzedaży zawiera…','Sales history includes…',
          [A('datę, ilość, cenę, P/L'),B('tylko obrazek'),C('PIN')],
          [A('date, qty, price, P/L'),B('only a picture'),C('PIN')],0),
      mc2('Możesz mieć zysk na jednej, stratę na innej?','Profit on one, loss on another?',
          [A('Tak'),B('Nie'),C('Tylko w piątek')],
          [A('Yes'),B('No'),C('Only on Friday')],0),
      mc2('Duży wynik dziś nie oznacza…','A big result today doesn’t mean…',
          [A('tego samego jutro'),B('wygranej w loterii'),C('zmiany regionu')],
          [A('the same tomorrow'),B('lottery win'),C('region change')],0),
      mc2('„Amount” w koszyku to…','“Amount” in basket is…',
          [A('łączny koszt planowanych zakupów'),B('zawsze 0'),C('PIN')],
          [A('total cost of planned buys'),B('always 0'),C('PIN')],0),
      mc2('Po sprzedaży gotówka trafia do…','After a sale, cash goes to…',
          [A('Investment cash'),B('Gifts'),C('Savings zawsze')],
          [A('Investment cash'),B('Gifts'),C('always Savings')],0),
      mc2('„Qty” w historii znaczy…','“Qty” in history means…',
          [A('ile sztuk/kwoty'),B('jaki region'),C('który wykres')],
          [A('how many units'),B('which region'),C('which chart')],0),
      mc2('P/L w FX zależy od…','FX P/L depends on…',
          [A('różnicy kursów'),B('pory dnia'),C('motywu')],
          [A('rate differences'),B('time of day'),C('theme')],0),
      mc2('Jeśli nie masz pozycji — unrealized P/L…','If you have no position — unrealized P/L…',
          [A('nie występuje'),B('jest ogromny'),C('zawsze −1')],
          [A('doesn’t exist'),B('is huge'),C('is always −1')],0),
      mc2('Śledzenie P/L pomaga…','Tracking P/L helps…',
          [A('uczyć się na danych'),B('zgubić budżet'),C('zmienić PIN')],
          [A('learn from data'),B('lose budget'),C('change PIN')],0)
    ];
    return { id:'pnl', title:(lang==='pl'?'P/L i średnie':'P/L & averages'), questions:Q };
  }

  // 10) Safety & smart habits
  function bankSafety(lang){
    const Q = [
      mc2('PIN rodzica…','Parent PIN…',
          [A('nie udostępniaj nikomu'),B('pisz na tablicy'),C('wysyłaj w czacie')],
          [A('don’t share with anyone'),B('write on a board'),C('send in chat')],0),
      mc2('Nie inwestuj prawdziwych pieniędzy bez…','Don’t invest real money without…',
          [A('zgody dorosłego'),B('memów'),C('losowania')],
          [A('adult permission'),B('memes'),C('a lottery')],0),
      mc2('Paper trading w nauce jest…','Paper trading for learning is…',
          [A('bezpieczne i pomocne'),B('zakazane'),C('bezużyteczne')],
          [A('safe and helpful'),B('forbidden'),C('useless')],0),
      mc2('Ustaw budżet, bo…','Set a budget because…',
          [A('chroni kieszonkowe'),B('wygrywa zawody'),C('zmienia kurs')],
          [A('it protects your cash'),B('wins contests'),C('changes rates')],0),
      mc2('Czytaj i pytaj, gdy…','Read and ask when…',
          [A('czegoś nie rozumiesz'),B('wszyscy kupują'),C('masz drzemkę')],
          [A('you don’t understand'),B('everyone buys'),C('you nap')],0),
      mc2('Gorące „tipy” z netu…','Hot tips online…',
          [A('traktuj z dystansem'),B('zawsze prawdziwe'),C('gwarantują zysk')],
          [A('treat carefully'),B('always true'),C('guarantee profit')],0),
      mc2('Historia to nie gwarancja…','Past is not a guarantee of…',
          [A('przyszłych wyników'),B('koloru wykresu'),C('udziału w loterii')],
          [A('future results'),B('chart color'),C('lottery entry')],0),
      mc2('Zabezpieczaj urządzenie…','Secure your device…',
          [A('hasłem/biometrią'),B('taśmą'),C('otwartym hasłem')],
          [A('with password/biometrics'),B('with tape'),C('with open password')],0),
      mc2('„Buy” naprawdę…','“Buy” really…',
          [A('kupuje'),B('robi screen'),C('zmienia język')],
          [A('buys'),B('takes a screenshot'),C('changes language')],0),
      mc2('Rozmawiaj z rodzicem o…','Talk with a parent about…',
          [A('celach i planie'),B('tajnych zakładach'),C('PIN-ie do banku')],
          [A('goals and plan'),B('secret bets'),C('bank PIN')],0),
      mc2('Notuj wnioski, bo…','Write notes because…',
          [A('pamięć bywa ulotna'),B('to mem'),C('appka nie lubi notatek')],
          [A('memory fades'),B('it’s a meme'),C('app hates notes')],0),
      mc2('Regularne przerwy…','Regular breaks…',
          [A('pomagają myśleć jasno'),B('psują wyniki'),C('blokują buy')],
          [A('help clear thinking'),B('ruin results'),C('block buy')],0),
      mc2('Zaufane źródła wiedzy to…','Trusted sources are…',
          [A('materiały, rodzice, nauczyciele'),B('anonimowe komentarze'),C('magiczne reklamy')],
          [A('learning materials, parents, teachers'),B('anonymous comments'),C('magic ads')],0),
      mc2('Cele SMART są…','SMART goals are…',
          [A('konkretne i mierzalne'),B('tajne i losowe'),C('magiczne')],
          [A('specific and measurable'),B('secret and random'),C('magic')],0),
      mc2('Małe kroki →','Small steps →',
          [A('mądrzejsza nauka'),B('szybki hazard'),C('więcej losu')],
          [A('smarter learning'),B('quick gambling'),C('more luck')],0),
      mc2('Zanim klikniesz — sprawdź…','Before clicking — check…',
          [A('ilość, cenę/kurs, koszyk'),B('pogodę'),C('kolor tła')],
          [A('qty, price/rate, basket'),B('weather'),C('background')],0),
      mc2('Nie każda okazja jest dla Ciebie — ważne są…','Not every opportunity is for you — important are…',
          [A('Twoje cele i budżet'),B('plotki'),C('złote reklamy')],
          [A('your goals and budget'),B('gossip'),C('golden ads')],0),
      mc2('Plan „co zrobię, gdy spadnie/urośnie” to…','A plan “what if it falls/rises” is…',
          [A('dobre przygotowanie'),B('zabobon'),C('nakaz')],
          [A('good preparation'),B('superstition'),C('a mandate')],0),
      mc2('Pytaj, ucz się, testuj — to…','Ask, learn, test — that’s…',
          [A('sekret postępów'),B('trik na skróty'),C('zbędne')],
          [A('the secret of progress'),B('a shortcut trick'),C('useless')],0),
      mc2('Szanuj pieniądze — to…','Respect money — it’s…',
          [A('narzędzie do celów'),B('gra bez zasad'),C('magiczna moneta')],
          [A('a tool for goals'),B('a rule-less game'),C('a magic coin')],0)
    ];
    return { id:'safety', title:(lang==='pl'?'Bezpieczeństwo i dobre nawyki':'Safety & smart habits'), questions:Q };
  }

  function makeBANKS(lang){
    return [
      bankBasicsApp(lang),
      bankStocksMath(lang),
      bankStockConcepts(lang),
      bankCharts(lang),
      bankFXBasics(lang),
      bankFXMath(lang),
      bankRisk(lang),
      bankWatchlistBasket(lang),
      bankPnL(lang),
      bankSafety(lang)
    ];
  }

  // ---------- STATE + RENDER ----------
  let S = { lang:getLang(), idx:0, score:0, bank:null, qs:[], mode:'home', BANKS: makeBANKS(getLang()) };

  function renderHome(){
    S.mode='home';
    const opts = S.BANKS.map((b,i)=>`<option value="${i}">${b.title} — 20Q</option>`).join('');
    out.innerHTML = `
      <div class="quiz-home">
        <div class="title">${t('homeTitle')}</div>
        <div class="sub">${t('homeSub')}</div>
        <div class="row" style="gap:8px;align-items:center;margin:8px 0;">
          <select id="qPick">${opts}</select>
          <button id="qGo" class="btn primary">${t('start')}</button>
          <button id="qRand" class="btn">${t('random')}</button>
        </div>
      </div>`;
    out.querySelector('#qGo').addEventListener('click', ()=>{
      const i = +out.querySelector('#qPick').value || 0; start(i);
    });
    out.querySelector('#qRand').addEventListener('click', ()=> start(Math.floor(Math.random()*S.BANKS.length)));
  }

  function start(i){
    S.bank = S.BANKS[i];
    S.qs = S.bank.questions.slice(0,20);
    S.idx = 0; S.score = 0; S.mode='q';
    renderQ();
  }

  function renderQ(){
    S.mode='q';
    const q = S.qs[S.idx];
    const n = S.idx+1;
    const choices = (q.choices[S.lang]||q.choices.en).map((t,j)=>(
      `<button class="qchoice" data-i="${j}">${t}</button>`
    )).join('');
    out.innerHTML = `
      <div class="quiz-q">
        <div class="muted">${S.bank.title} — ${t('qOf')} ${n}/20</div>
        <div class="title" style="margin:6px 0 8px">${q.q[S.lang]||q.q.en}</div>
        <div class="space" style="display:flex;flex-direction:column;gap:6px">${choices}</div>
        <div id="qMsg" class="sub" style="min-height:22px;margin-top:6px"></div>
        <div class="row" style="gap:8px;margin-top:8px">
          <button id="qSkip" class="btn">${t('skip')}</button>
          <button id="qStop" class="btn danger">${t('stop')}</button>
        </div>
      </div>`;
    out.querySelectorAll('.qchoice').forEach(b=>b.addEventListener('click', onPick));
    out.querySelector('#qSkip').addEventListener('click', next);
    out.querySelector('#qStop').addEventListener('click', finish);
  }

  function onPick(e){
    const pick = +e.currentTarget.dataset.i;
    const q = S.qs[S.idx];
    const ok = pick===q.a;
    if (ok) S.score++;
    const msg = out.querySelector('#qMsg');
    if (msg) msg.textContent = (ok ? t('good') : t('almost')) + (q.explain[S.lang]||q.explain.en||'');
    setTimeout(()=> next(), 700);
  }

  function next(){
    S.idx++;
    if (S.idx>=20) finish(); else renderQ();
  }

  function finish(){
    S.mode='done';
    const pct = Math.round(100*S.score/20);
    out.innerHTML = `
      <div class="quiz-done">
        <div class="title">${t('score')}: ${S.score}/20 (${pct}%)</div>
        <div class="sub" style="margin:6px 0">${msgByPct(pct)}</div>
        <div class="row" style="gap:8px">
          <button id="qAgain" class="btn primary">${t('again')}</button>
          <button id="qHome" class="btn">${t('choose')}</button>
        </div>
      </div>`;
    out.querySelector('#qAgain').addEventListener('click', ()=> start(Math.floor(Math.random()*S.BANKS.length)));
    out.querySelector('#qHome').addEventListener('click', renderHome);
  }

  // ---------- LIVE LANGUAGE SWITCH ----------
  function refreshLang(){
    const newLang = getLang();
    if (newLang === S.lang) return;
    S.lang = newLang;
    S.BANKS = makeBANKS(S.lang); // odśwież tytuły/teksty
    if (S.mode==='home') renderHome();
    else if (S.mode==='q') renderQ();
    else if (S.mode==='done') finish();
  }
  const langSel = document.getElementById('langSelect');
  if (langSel) langSel.addEventListener('change', refreshLang);

  // reaguj też na przycisk #lang-toggle (jeśli zmienia język w Twoim kodzie)
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.addEventListener('click', () => setTimeout(refreshLang, 50));

  // start: pokaz ekran wyboru
  startBtn.addEventListener('click', renderHome);
})();

