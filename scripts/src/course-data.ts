// Authoritative definition of the "Łatwa Fizyka" course: 3 działy, 21 lekcje and
// the 14 quizzes (verbatim questions/options + correct answers). Videos and
// images are NOT listed here — they are derived at seed time from the Bunny
// video map (scripts/data/bunny-videos.json) and the copied PNG assets, matched
// by the lesson code (e.g. "D1_L03"). Answer keys for Dział 1 and Dział 3 come
// from the source quiz files; Dział 2 quiz files shipped without keys, so the
// correct answers there are the unambiguous textbook answers for each question.

export type QuizOption = { label: string; text: string };
export type QuizQuestion = { q: string; options: QuizOption[]; correct: string };
export type Quiz = { questions: QuizQuestion[] };

// Explicit lesson material (used by Dział 4). Dział 1–3 derive videos/images
// from the Bunny map + PNG folder by lesson code; Dział 4 cannot, because its
// videos reuse "ScreenRecorderProject" source names across lessons (the seed's
// dedup-by-source would collapse distinct clips) and its PNG cards carry
// answer/solution/related-video metadata. When a lesson lists these arrays the
// seed uses them verbatim instead of deriving materials by code.
export type VideoDef = {
  // Exact Bunny upload filename (WITH extension) — resolves GUID + duration
  // from scripts/data/bunny-videos.json at seed time.
  file: string;
  title: string;
  sortOrder: number;
};

export type ImageDef = {
  // PNG filename copied into artifacts/physics-platform/public/course-assets.
  file: string;
  // Task/question text — rendered as the visible caption AND the image alt.
  alt: string;
  // Answer + full worked solution: stored but HIDDEN client-side until the
  // student chooses to reveal them.
  answer: string;
  solution: string;
  // Filename (WITH extension) of the preceding worked-example video this card
  // refers to; the seed stores it WITHOUT extension so the API resolves it to a
  // concrete video id for the "see the worked example" link.
  relatedVideo: string;
  sortOrder: number;
};

export type LessonDef = {
  code: string; // matches Bunny/asset tokens, e.g. "D1_L01"
  title: string;
  slug: string;
  sortOrder: number;
  isPreview?: boolean;
  description?: string;
  quiz?: Quiz;
  // Optional explicit materials (see VideoDef/ImageDef). Only Dział 4 uses them.
  videos?: VideoDef[];
  images?: ImageDef[];
};

export type SectionDef = {
  title: string;
  slug: string;
  sortOrder: number;
  bunnyCollectionId: string;
  lessons: LessonDef[];
};

// Option helper: all quizzes use uppercase A/B/C/D labels regardless of the
// original file casing.
function o(label: string, text: string): QuizOption {
  return { label, text };
}

const quizD1L01: Quiz = {
  questions: [
    {
      q: "Jakie trzy główne zadania fizyki zostały wymienione w tekście?",
      options: [
        o("A", "Budowanie maszyn, programowanie i przewidywanie pogody."),
        o("B", "Odkrywanie podstawowych praw przyrody, wyjaśnianie zjawisk i opisywanie właściwości materii."),
        o("C", "Wymyślanie wzorów matematycznych, tworzenie instrukcji obsługi i badanie biologii."),
        o("D", "Obserwowanie kosmosu, ochrona przyrody i nauka o zwierzętach."),
      ],
      correct: "B",
    },
    {
      q: 'Zgodnie ze "ściągą" z filmu, w jaki sposób najprościej odróżnić ciało fizyczne od substancji?',
      options: [
        o("A", "Ciało fizyczne to materiał (np. szkło), a substancja to gotowy przedmiot (np. szklanka)."),
        o("B", 'Ciało fizyczne to odpowiedź na pytanie "Co to jest?", a substancja to odpowiedź na "Z czego to jest zrobione?".'),
        o("C", "Ciało fizyczne to wyłącznie istota żywa, a substancja to przedmiot martwy."),
        o("D", "W fizyce nie ma różnicy między tymi pojęciami, oznaczają to samo."),
      ],
      correct: "B",
    },
    {
      q: "Dlaczego organizmy żywe (np. ryba, pies, ty) w fizyce są traktowane jako ciała fizyczne?",
      options: [
        o("A", "Ponieważ zajmują miejsce w przestrzeni, mają swoją masę i działają na nie różne siły."),
        o("B", 'Ponieważ w fizyce słowo "ciało" oznacza wyłącznie organizmy biologiczne.'),
        o("C", "Ponieważ potrafią się same poruszać, w przeciwieństwie do gwoździa czy szklanki."),
        o("D", "Organizmy żywe nie są ciałami fizycznymi, zajmuje się nimi tylko biologia."),
      ],
      correct: "A",
    },
    {
      q: "Na czym polega najważniejsza różnica między obserwacją a eksperymentem?",
      options: [
        o("A", "Obserwację prowadzi się w laboratorium, a eksperyment wyłącznie na zewnątrz."),
        o("B", "W obserwacji celowo modyfikuje się otoczenie, a w eksperymencie tylko patrzy z ukrycia."),
        o("C", "Podczas obserwacji nie ingerujesz w badany świat, a w eksperymencie celowo zmieniasz zasady i warunki."),
        o("D", "Obserwacja wymaga skomplikowanych maszyn, a eksperyment wykonuje się bez użycia narzędzi."),
      ],
      correct: "C",
    },
    {
      q: "Która z poniższych sytuacji przedstawionych w tekście jest przykładem eksperymentu, a nie obserwacji?",
      options: [
        o("A", "Podglądanie zachowania tygrysa i papugi w dżungli z ukrycia."),
        o("B", "Mierzenie siły wiatru i ilości opadów deszczu na stacji meteorologicznej."),
        o("C", "Zapisywanie w notatniku, w jakim kierunku płynie woda w rzece."),
        o("D", "Celowe zmienianie nachylenia rampy i mierzenie czasu stoczenia się autka."),
      ],
      correct: "D",
    },
  ],
};

const quizD1L02: Quiz = {
  questions: [
    {
      q: "Na czym według tekstu polega proces pomiaru?",
      options: [
        o("A", 'Na odgadywaniu wymiarów przedmiotu "na oko".'),
        o("B", "Na porównaniu wartości mierzonej z ustaloną wartością wzorcową."),
        o("C", "Na dodawaniu do siebie różnych jednostek miary z Układu SI."),
        o("D", "Na rozkładaniu przedmiotu na najmniejsze elementy i ich liczeniu."),
      ],
      correct: "B",
    },
    {
      q: "Jaka jest podstawowa jednostka temperatury w układzie SI, którą tekst określa mianem podchwytliwej pułapki na sprawdzianach?",
      options: [
        o("A", "Stopień Celsjusza"),
        o("B", "Stopień Fahrenheita"),
        o("C", "Kelwin"),
        o("D", "Paskal"),
      ],
      correct: "C",
    },
    {
      q: "Zgodnie z tekstem wielkość fizyczna to cecha, którą można obiektywnie zmierzyć. Która z poniższych cech klocka NIE JEST wielkością fizyczną?",
      options: [
        o("A", "Objętość"),
        o("B", "Masa"),
        o("C", "Temperatura"),
        o("D", "Ostrość krawędzi"),
      ],
      correct: "D",
    },
    {
      q: 'Przed jaką pułapką ostrzega tekst w kontekście przedrostków zapisywanych literą "M" i "m"?',
      options: [
        o("A", 'Wielkie "M" to przedrostek mega (mnożnik przez milion), a małe "m" to mili (krojenie na tysiąc części).'),
        o("B", 'Wielkie "M" oznacza metry, a małe "m" to minuty.'),
        o("C", 'Wielkie "M" to makro, a małe "m" to mikro (dzielenie przez milion).'),
        o("D", "Obie litery oznaczają dokładnie to samo i można ich używać zamiennie na sprawdzianach."),
      ],
      correct: "A",
    },
    {
      q: "Dlaczego w tekście przeliczanie jednostek czasu (np. zamiana minut na sekundy) zostało nazwane największą pułapką?",
      options: [
        o("A", "Ponieważ sekunda nie jest jednostką należącą do Układu SI."),
        o("B", "Ponieważ podczas zamiany minut na sekundy należy zawsze używać dzielenia przez 1000."),
        o("C", "Ponieważ w fizyce czasu nie da się dokładnie zmierzyć stoperem."),
        o("D", "Ponieważ czas omija zasady dziesiątek i setek, a przy zamianie minut na sekundy zawsze mnożymy przez 60."),
      ],
      correct: "D",
    },
  ],
};

const quizD1L03: Quiz = {
  questions: [
    {
      q: "Dlaczego według tekstu w fizyce KAŻDY pomiar jest niedokładny i daje różne wyniki?",
      options: [
        o("A", "Ponieważ narzędzia pomiarowe oraz my sami nie jesteśmy idealni (np. przez drżenie ręki czy grubość kresek na miarce)."),
        o("B", "Ponieważ przedmioty w laboratorium cały czas zmieniają swój rozmiar pod wpływem temperatury."),
        o("C", "Ponieważ w fizyce celowo używa się błędnych narzędzi, żeby trudniej było wyliczyć wynik."),
        o("D", "Ponieważ klocki podczas mierzenia zawsze minimalnie się przesuwają na stole."),
      ],
      correct: "A",
    },
    {
      q: "Co powinien zrobić fizyk, aby poznać faktyczną długość przedmiotu po uzyskaniu kilku różnych wyników z pomiarów?",
      options: [
        o("A", "Wybrać tylko i wyłącznie największy ze wszystkich wyników, żeby nie zabrakło materiału."),
        o("B", "Dodać wszystkie wyniki do siebie i podzielić przez ich liczbę, obliczając w ten sposób średnią arytmetyczną."),
        o("C", 'Zignorować otrzymane liczby i spróbować oszacować wymiary przedmiotu "na oko".'),
        o("D", "Odrzucić najmniejszy wynik, a resztę pomnożyć przez 10."),
      ],
      correct: "B",
    },
    {
      q: "Zgodnie z klockowym prawem zaokrąglania z tekstu, co powinieneś zrobić, gdy Twój wynik wynosi 3,4?",
      options: [
        o("A", "Zaokrąglić w górę, czyli dodać jeden, aby otrzymać pełną czwórkę."),
        o("B", "Zostawić wynik bez zmian, ponieważ w fizyce nigdy nie ucina się ogonków po przecinku."),
        o("C", "Zaokrąglić w dół, czyli po prostu uciąć ogonek po przecinku i zostać przy twardej, pełnej trójce."),
        o("D", "Przesunąć przecinek w prawo, żeby otrzymać nową liczbę 34."),
      ],
      correct: "C",
    },
    {
      q: 'W jakiej sytuacji nasza główna liczba robi "Level Up" i zostaje zaokrąglona w górę (np. zamienia się z 3,7 na 4)?',
      options: [
        o("A", "Zawsze, gdy wynik posiada na końcu po przecinku jakąkolwiek cyfrę parzystą."),
        o("B", "Kiedy pierwsza cyfra po przecinku jest równa 5 albo większa."),
        o("C", "Kiedy pierwsza cyfra po przecinku jest mniejsza niż 5."),
        o("D", "Kiedy obok badanej liczby postawimy znak drogowy."),
      ],
      correct: "B",
    },
    {
      q: "Na czym polega gigantyczna pułapka przy zaokrąglaniu dużych liczb do cyfr znaczących (tak jak w przypadku liczby 3456 zaokrąglanej do dwóch cyfr znaczących)?",
      options: [
        o("A", "Na błędnym wstawianiu przecinka w połowie wielkiej liczby."),
        o("B", "Na szukaniu najważniejszych cyfr VIP, zaczynając błędnie od prawej strony."),
        o("C", "Na dodaniu do wyniku dodatkowego tysiąca z powodu użycia żółtych klocków."),
        o("D", "Na braku uzupełnienia odrzuconych miejsc zerami, przez co wielka liczba drastycznie maleje i traci skalę (np. zapisanie małego 35 zamiast 3500)."),
      ],
      correct: "D",
    },
  ],
};

const quizD1L04: Quiz = {
  questions: [
    {
      q: "Które z wymienionych oddziaływań, zgodnie z tekstem, potrafią działać na odległość i nie wymagają bezpośredniego dotyku?",
      options: [
        o("A", "Grawitacyjne, elektrostatyczne i magnetyczne"),
        o("B", "Mechaniczne, sprężyste i grawitacyjne"),
        o("C", "Tylko oddziaływanie grawitacyjne"),
        o("D", "Wszystkie oddziaływania fizyczne wymagają bezpośredniego kontaktu"),
      ],
      correct: "A",
    },
    {
      q: "Jaka jest najważniejsza reguła dotycząca grawitacji opisana w tekście?",
      options: [
        o("A", "Oddziaływanie grawitacyjne potrafi zarówno przyciągać, jak i odpychać inne przedmioty."),
        o("B", "Grawitacja działa tylko na planecie Ziemia, a w kosmosie zupełnie zanika."),
        o("C", "Grawitacja zawsze i wyłącznie przyciąga obiekty, nigdy ich nie odpycha."),
        o("D", "Grawitacja przyciąga tylko materiały ferromagnetyczne."),
      ],
      correct: "C",
    },
    {
      q: "Jak, według tekstu, zachowają się dwa takie same ładunki elektryczne (np. dwa minusy) albo dwa identyczne bieguny magnesu?",
      options: [
        o("A", "Błyskawicznie się przyciągną i połączą ze sobą."),
        o("B", "Będą uciekać od siebie i się odpychać."),
        o("C", "Zaczną drastycznie zmieniać swój kształt."),
        o("D", "Zignorują się nawzajem, bo brakuje plusa."),
      ],
      correct: "B",
    },
    {
      q: "O skutku statycznym oddziaływania mówimy wtedy, gdy:",
      options: [
        o("A", "uderzony przedmiot nagle wystrzeliwuje do przodu (zostaje wprawiony w ruch)."),
        o("B", "pędzący bolid wciska hamulec i zwalnia."),
        o("C", "działająca siła zmusza pojazd do zmiany kierunku ruchu."),
        o("D", "przedmiot pod wpływem siły nie porusza się, ale zmienia swój kształt (np. zgniata się lub wygina)."),
      ],
      correct: "D",
    },
    {
      q: "Który z poniższych przykładów z tekstu jest skutkiem dynamicznym oddziaływania?",
      options: [
        o("A", "Ściśnięcie maszynami spirali, tak że staje się nagle dużo krótsza."),
        o("B", "Zmiana kierunku ruchu przez pojazd, aby ominąć przeszkodę na drodze."),
        o("C", "Wgniecenie, lepienie i rozciąganie kuli z miękkiej plasteliny."),
        o("D", "Ugięcie się długiej belki (mostu) pod ciężarem wjeżdżającej ciężarówki."),
      ],
      correct: "B",
    },
  ],
};

const quizD1L05: Quiz = {
  questions: [
    {
      q: "Od jakiego angielskiego słowa pochodzi litera F, którą fizycy oznaczają siłę, oraz w jakich jednostkach się ją mierzy?",
      options: [
        o("A", "Od słowa Fast, a mierzy się ją w kilometrach."),
        o("B", "Od słowa Force, a mierzy się ją w niutonach."),
        o("C", "Od słowa Form, a mierzy się ją w kilogramach."),
        o("D", "Od słowa Friction, a mierzy się ją w metrach."),
      ],
      correct: "B",
    },
    {
      q: "Jaki przykład podano w tekście, aby zobrazować siłę o wartości jednego niutona?",
      options: [
        o("A", "Zderzenie klockowego autka ze ścianą."),
        o("B", "Opór, jaki stawiają dwa odpychające się magnesy."),
        o("C", "Delikatny nacisk stugramowej tabliczki czekolady na otwartą dłoń."),
        o("D", "Pchanie dużej ciężarówki siłą dziesięciu niutonów."),
      ],
      correct: "C",
    },
    {
      q: 'Na czym polega inżynieryjny sekret, czyli "wybór odpowiedniej skali" podczas rysowania wektorów siły w zeszycie w kratkę?',
      options: [
        o("A", "Na tym, że wszystkie strzałki zawsze muszą mieć tę samą długość, niezależnie od siły."),
        o("B", "Na samodzielnym ustaleniu, jakiej sile (np. ilu niutonom) odpowiada jedna kratka, aby rysunek dużej siły zmieścił się w zeszycie."),
        o("C", "Na rysowaniu większych sił grubszym pisakiem, a mniejszych cienkim ołówkiem."),
        o("D", "Na zamianie jednostek z niutonów na centymetry, by łatwiej było użyć linijki na gładkim papierze."),
      ],
      correct: "B",
    },
    {
      q: 'Czym, według tekstu, jest "punkt przyłożenia" siły?',
      options: [
        o("A", "Niewidzialną linią, wzdłuż której działa siła."),
        o("B", "Wartością liczbową mówiącą nam, jak mocno pchamy dany przedmiot."),
        o("C", "Stroną, w którą skierowany jest grot narysowanej strzałki."),
        o("D", "Konkretnym, malutkim miejscem kontaktu, w którym stykasz się z przedmiotem i zaczynasz na niego działać."),
      ],
      correct: "D",
    },
    {
      q: 'Jaka jest kluczowa różnica między "kierunkiem" a "zwrotem" siły, określona w tekście jako największa pułapka?',
      options: [
        o("A", "Kierunek i zwrot to w fizyce dokładnie to samo i można używać tych słów zamiennie."),
        o("B", "Kierunek to niewidzialna linia działania siły (jak sztywne tory), a zwrot to konkretna strona oznaczona grotem strzałki (znak dokąd jedziemy)."),
        o("C", "Kierunek określa wartość siły w niutonach, a zwrot to miejsce dotyku przedmiotu."),
        o("D", "Kierunek dotyczy wyłącznie grawitacji, a zwrot oddziaływań mechanicznych."),
      ],
      correct: "B",
    },
  ],
};

// Dział 2 quiz files shipped without answer keys; the correct answers below are
// the unambiguous textbook answers determined from each lesson's content.
const quizD2L02: Quiz = {
  questions: [
    {
      q: "Czym według tekstu jest atom?",
      options: [
        o("A", "Dowolnym połączeniem dwóch różnych pierwiastków."),
        o("B", "Częścią klocka LEGO, z którego buduje się wodę."),
        o("C", "Najmniejszą, niepodzielną chemicznie „cegiełką” budującą pierwiastek."),
        o("D", "Zjawiskiem mieszania się różnych substancji."),
      ],
      correct: "C",
    },
    {
      q: "Co powstaje w wyniku połączenia ze sobą kilku atomów (np. tlenu i wodoru)?",
      options: [
        o("A", "Nowy pierwiastek"),
        o("B", "Cząsteczka"),
        o("C", "Detergent"),
        o("D", "Stan stały"),
      ],
      correct: "B",
    },
    {
      q: "Zgodnie z tekstem materia nie jest ciągła. Jaką zatem ma budowę?",
      options: [
        o("A", "Ziarnistą"),
        o("B", "Płynną"),
        o("C", "Losową"),
        o("D", "Niewidzialną"),
      ],
      correct: "A",
    },
    {
      q: "W którym stanie skupienia cząsteczki poruszają się najszybciej i panuje wśród nich „totalny chaos”?",
      options: [
        o("A", "W ciele stałym"),
        o("B", "W cieczy"),
        o("C", "W gazie"),
        o("D", "We wszystkich stanach poruszają się tak samo"),
      ],
      correct: "C",
    },
    {
      q: "Jaka jest złota zasada fizyki dotycząca temperatury i ruchu cząsteczek?",
      options: [
        o("A", "Im jest cieplej, tym cząsteczki poruszają się wolniej."),
        o("B", "Temperatura nie ma żadnego wpływu na ruch cząsteczek."),
        o("C", "Cząsteczki całkowicie się zatrzymują przy wysokiej temperaturze."),
        o("D", "Im jest cieplej, tym cząsteczki poruszają się szybciej."),
      ],
      correct: "D",
    },
    {
      q: "Dzięki jakiej sile krople deszczu trzymają się szyby okna lub pajęczyny?",
      options: [
        o("A", "Sile spójności"),
        o("B", "Sile przylegania"),
        o("C", "Sile grawitacji"),
        o("D", "Sile wyporu"),
      ],
      correct: "B",
    },
    {
      q: "Siły spójności można opisać jako:",
      options: [
        o("A", "Wzajemne przyciąganie się cząsteczek tej samej substancji (np. woda z wodą)."),
        o("B", "Wzajemne przyciąganie się cząsteczek różnych substancji (np. woda i szkło)."),
        o("C", "Łączenie się atomów węgla i wodoru w metan."),
        o("D", "Działanie detergentów na brud."),
      ],
      correct: "A",
    },
    {
      q: "Jak nazywa się zjawisko samorzutnego mieszania się cząsteczek różnych substancji (np. zapachu perfum w powietrzu lub herbaty w wodzie)?",
      options: [
        o("A", "Napięcie powierzchniowe"),
        o("B", "Dyfuzja"),
        o("C", "Kondensacja"),
        o("D", "Parowanie"),
      ],
      correct: "B",
    },
    {
      q: "Dlaczego owady wodne potrafią spacerować po powierzchni stawu i nie toną, a spinacz unosi się na wodzie?",
      options: [
        o("A", "Ponieważ działają na nie siły przylegania."),
        o("B", "Ponieważ woda w stawie punktowo zamienia się w ciało stałe."),
        o("C", "Dzięki napięciu powierzchniowemu, które tworzy na wodzie niewidzialną „błonkę”."),
        o("D", "Dzięki szybkiej dyfuzji cząsteczek powietrza."),
      ],
      correct: "C",
    },
    {
      q: "Jak działają detergenty (np. płyn do naczyń) na wodę?",
      options: [
        o("A", "Zwiększają napięcie powierzchniowe wody."),
        o("B", "Zmniejszają napięcie powierzchniowe wody, rozrywając silne połączenia między jej cząsteczkami."),
        o("C", "Zamieniają cząsteczki wody w gaz, by ułatwić mycie."),
        o("D", "Sprawiają, że woda zaczyna szybciej zamarzać."),
      ],
      correct: "B",
    },
  ],
};

const quizD2L04: Quiz = {
  questions: [
    {
      q: "Jak zachowują się cząsteczki w ciele stałym (np. w lodzie)?",
      options: [
        o("A", "Ślizgają się swobodnie jedna po drugiej."),
        o("B", "Pędzą we wszystkich kierunkach i latają swobodnie."),
        o("C", "Są ułożone bardzo blisko siebie i mogą co najwyżej delikatnie drgać w miejscu."),
        o("D", "Stale zmieniają swój kształt."),
      ],
      correct: "C",
    },
    {
      q: "Dlaczego woda w szklance może się przelewać i dopasowywać do jej kształtu?",
      options: [
        o("A", "Ponieważ cząsteczki cieczy mają na tyle luzu, że mogą się przemieszczać i ślizgać po sobie."),
        o("B", "Ponieważ cząsteczki w cieczy są zablokowane w sztywnej klatce."),
        o("C", "Ponieważ między cząsteczkami cieczy jest mnóstwo pustej przestrzeni."),
        o("D", "Ponieważ cząsteczki wody są sprężyste."),
      ],
      correct: "A",
    },
    {
      q: "W którym stanie skupienia cząsteczki mają najwięcej energii i nic ich nie ogranicza?",
      options: [
        o("A", "W ciele stałym"),
        o("B", "W cieczy"),
        o("C", "W gazie"),
        o("D", "W ciele plastycznym"),
      ],
      correct: "C",
    },
    {
      q: "Co charakteryzuje ciała stałe pod względem ich formy?",
      options: [
        o("A", "Mają stałą objętość, ale przyjmują kształt naczynia."),
        o("B", "Zajmują całą dostępną przestrzeń."),
        o("C", "Nie mają ani własnego kształtu, ani objętości."),
        o("D", "Mają swój określony kształt i objętość."),
      ],
      correct: "D",
    },
    {
      q: "Jak nazywamy ciała stałe (np. czerwoną sprężynę z tekstu), które po rozciągnięciu lub wygięciu wracają do swojego pierwotnego kształtu?",
      options: [
        o("A", "Kruche"),
        o("B", "Sprężyste"),
        o("C", "Plastyczne"),
        o("D", "Ściśliwe"),
      ],
      correct: "B",
    },
    {
      q: "Czym charakteryzują się ciała plastyczne, takie jak klockowa plastelina?",
      options: [
        o("A", "Po zmianie kształtu wracają do pierwotnej formy."),
        o("B", "Rozpadają się na kawałki pod wpływem siły."),
        o("C", "Kiedy zmienimy ich kształt, to już w takiej nowej formie zostają."),
        o("D", "Zachowują się jak gaz i uciekają z pojemnika."),
      ],
      correct: "C",
    },
    {
      q: "Co się dzieje z cieczą (np. wodą), gdy przelejemy ją z wysokiej wieży do okrągłej misy?",
      options: [
        o("A", "Zmienia się jej objętość oraz kształt."),
        o("B", "Zachowuje swój własny kształt, ale zmienia objętość."),
        o("C", "Zamienia się w gaz, wypełniając całe naczynie."),
        o("D", "Ma nadal tę samą objętość, ale przyjmuje kształt nowego naczynia."),
      ],
      correct: "D",
    },
    {
      q: "Dlaczego ciała stałe i ciecze są trudno ściśliwe?",
      options: [
        o("A", "Ponieważ ich cząsteczki są upakowane bardzo ciasno i ciężko jest je do siebie zbliżyć."),
        o("B", "Ponieważ rozpadają się na kawałki podczas próby ściśnięcia."),
        o("C", "Ponieważ między ich cząsteczkami jest mnóstwo wolnej przestrzeni."),
        o("D", "Ponieważ nie posiadają powierzchni swobodnej."),
      ],
      correct: "A",
    },
    {
      q: "Dlaczego nasz bohater bez problemu może zgnieść pustą butelkę wypełnioną gazem (powietrzem)?",
      options: [
        o("A", "Ponieważ gazy są kruche."),
        o("B", "Ponieważ gazy mają swój określony kształt."),
        o("C", "Ponieważ gazy są ściśliwe – między ich cząsteczkami jest dużo pustej przestrzeni, więc łatwo je do siebie dosunąć."),
        o("D", "Ponieważ wewnątrz butelki nie ma w ogóle żadnych cząsteczek."),
      ],
      correct: "C",
    },
    {
      q: "Czym jest powierzchnia swobodna cieczy?",
      options: [
        o("A", "To dno każdego naczynia, w którym znajduje się woda."),
        o("B", "To górna granica cieczy, która styka się z powietrzem (gazem) nad nią."),
        o("C", "To siła, która zgniata cząsteczki wewnątrz cieczy."),
        o("D", "To zjawisko zamarzania wody na powierzchni."),
      ],
      correct: "B",
    },
  ],
};

const quizD2L06: Quiz = {
  questions: [
    {
      q: "Czym według tekstu jest masa (oznaczana literą m)?",
      options: [
        o("A", "Niewidzialną liną, z jaką Ziemia ciągnie przedmioty."),
        o("B", "Ilością materii, czyli tym, z ilu „klocków” zbudowane jest ciało."),
        o("C", "Przyspieszeniem ziemskim wyrażanym w niutonach."),
        o("D", "Kształtem i objętością danego przedmiotu."),
      ],
      correct: "B",
    },
    {
      q: "W jakich jednostkach mierzymy siłę ciężkości (oznaczaną literą F)?",
      options: [
        o("A", "W kilogramach (kg)"),
        o("B", "W gramach (g)"),
        o("C", "W niutonach (N)"),
        o("D", "W tonach (t)"),
      ],
      correct: "C",
    },
    {
      q: "Ile wynosi w przybliżeniu współczynnik proporcjonalności (g) na Ziemi?",
      options: [
        o("A", "1,62 N/kg"),
        o("B", "10 N/kg"),
        o("C", "100 N/kg"),
        o("D", "1000 N/kg"),
      ],
      correct: "B",
    },
    {
      q: "Klockowa sztanga ma masę 2 kg. Z jaką siłą (ciężarem) przyciąga ją Ziemia?",
      options: [
        o("A", "2 N"),
        o("B", "10 N"),
        o("C", "20 N"),
        o("D", "200 N"),
      ],
      correct: "C",
    },
    {
      q: "Duży materac i mały odważnik mają taką samą masę (2 kg). Który z nich Ziemia przyciąga mocniej?",
      options: [
        o("A", "Materac, ponieważ jest większy i bardziej rozłożysty."),
        o("B", "Odważnik, ponieważ jest bardziej zbity i gęsty."),
        o("C", "Ziemia przyciąga je z dokładnie taką samą siłą, bo liczy się tylko masa."),
        o("D", "Ziemia nie przyciąga ich wcale, dopóki się nie poruszą."),
      ],
      correct: "C",
    },
    {
      q: "Co się stanie z masą i ciężarem Jasia, gdy poleci na Księżyc, gdzie grawitacja jest słabsza?",
      options: [
        o("A", "Jego masa i ciężar się nie zmienią."),
        o("B", "Jego masa zmaleje, a ciężar wzrośnie."),
        o("C", "Jego masa wzrośnie, ale ciężar spadnie do zera."),
        o("D", "Jego masa się nie zmieni, ale jego ciężar będzie znacznie mniejszy."),
      ],
      correct: "D",
    },
    {
      q: "Woreczek klocków waży 1300 gramów (g). Jak zamienić tę wartość na kilogramy (kg)?",
      options: [
        o("A", "Podzielić przez 1000 (wynik: 1,3 kg)"),
        o("B", "Pomnożyć przez 1000 (wynik: 1300000 kg)"),
        o("C", "Podzielić przez 100 (wynik: 13 kg)"),
        o("D", "Pomnożyć przez 10 (wynik: 13000 kg)"),
      ],
      correct: "A",
    },
    {
      q: "Klockowa ciężarówka ma masę 4 ton (t). Ile to kilogramów?",
      options: [
        o("A", "40 kg"),
        o("B", "400 kg"),
        o("C", "4000 kg"),
        o("D", "40000 kg"),
      ],
      correct: "C",
    },
    {
      q: "Jakiego wzoru używamy, aby obliczyć masę przedmiotu (m), znając jego ciężar (F) na Ziemi?",
      options: [
        o("A", "m = F × g"),
        o("B", "m = F : g"),
        o("C", "m = g : F"),
        o("D", "m = F + g"),
      ],
      correct: "B",
    },
    {
      q: "Klockowy motocykl jest przyciągany przez Ziemię z siłą 2500 N. Jaka jest jego masa w kilogramach?",
      options: [
        o("A", "25 kg"),
        o("B", "250 kg"),
        o("C", "2500 kg"),
        o("D", "25000 kg"),
      ],
      correct: "B",
    },
  ],
};

const quizD2L08: Quiz = {
  questions: [
    {
      q: "Co oznacza sytuacja, gdy na wadze szalkowej mały odważnik i duża sterta klocków są na tym samym poziomie?",
      options: [
        o("A", "Mają różną masę, ale taką samą objętość"),
        o("B", "Mają taką samą masę, ale różną objętość"),
        o("C", "Szary odważnik ma mniejszą gęstość niż klocki"),
        o("D", "Kolorowe klocki mają większą masę niż odważnik"),
      ],
      correct: "B",
    },
    {
      q: "Jakiego wzoru używamy do obliczenia gęstości?",
      options: [
        o("A", "d = m * V"),
        o("B", "d = V / m"),
        o("C", "d = m / V"),
        o("D", "m = d / V"),
      ],
      correct: "C",
    },
    {
      q: "Złota zasada gęstości mówi, że jeśli mamy przedmioty o dokładnie takich samych rozmiarach (objętości), to:",
      options: [
        o("A", "Ten o najmniejszej gęstości będzie miał największą masę"),
        o("B", "Ten o największej objętości będzie najcięższy"),
        o("C", "Ten zbudowany z największej liczby elementów będzie najlżejszy"),
        o("D", "Ten o największej gęstości zawsze będzie miał największą masę"),
      ],
      correct: "D",
    },
    {
      q: "Dlaczego blok z miedzi waży więcej (1,78 kg) niż blok z aluminium (0,54 kg), mimo że zajmują tyle samo miejsca?",
      options: [
        o("A", "Ponieważ miedź ma mniejszą gęstość niż aluminium"),
        o("B", "Ponieważ miedź ma większą gęstość niż aluminium"),
        o("C", "Ponieważ miedź zajmuje więcej miejsca"),
        o("D", 'Ponieważ aluminium jest "ciaśniej upakowane"'),
      ],
      correct: "B",
    },
    {
      q: "W jaki sposób zamieniamy centymetry sześcienne na metry sześcienne?",
      options: [
        o("A", "Mnożymy wartość przez tysiąc"),
        o("B", "Dzielimy wartość przez tysiąc"),
        o("C", "Mnożymy wartość przez milion"),
        o("D", "Dzielimy wartość przez milion"),
      ],
      correct: "D",
    },
    {
      q: "Jeden decymetr sześcienny to dokładnie ta sama objętość co:",
      options: [
        o("A", "1 metr sześcienny"),
        o("B", "1 centymetr sześcienny"),
        o("C", "1 litr"),
        o("D", "1000 litrów"),
      ],
      correct: "C",
    },
    {
      q: "Jak zamienić gęstość podaną w małych jednostkach (g/cm3) na duże jednostki (kg/m3)?",
      options: [
        o("A", "Należy podzielić wynik przez 100"),
        o("B", "Należy pomnożyć wynik przez 100"),
        o("C", "Należy podzielić wynik przez 1000"),
        o("D", "Należy pomnożyć wynik przez 1000"),
      ],
      correct: "D",
    },
    {
      q: "Jak najłatwiej zmierzyć objętość przedmiotu o nieregularnym, dziwnym kształcie?",
      options: [
        o("A", "Mierząc linijką jego najdłuższe boki"),
        o("B", "Używając metody wypierania cieczy (np. w menzurce)"),
        o("C", "Ważąc go na wadze i mnożąc wynik przez 1000"),
        o("D", "Obliczając objętość naczynia, w którym się znajduje"),
      ],
      correct: "B",
    },
    {
      q: "Jak obliczyć objętość klockowej budowli w kształcie prostopadłościanu?",
      options: [
        o("A", "Dodając do siebie długość, szerokość i wysokość"),
        o("B", "Mnożąc przez siebie długość, szerokość i wysokość"),
        o("C", "Dzieląc długość przez szerokość"),
        o("D", "Mnożąc długość przez szerokość i dodając wysokość"),
      ],
      correct: "B",
    },
    {
      q: "Dlaczego gęstość cukru obliczona w szklance była niższa niż oficjalna gęstość samej sacharozy?",
      options: [
        o("A", "Ponieważ waga użyta w eksperymencie była zepsuta"),
        o("B", "Ponieważ źle odczytano objętość szklanki"),
        o("C", "Ponieważ woda wyparła część cukru z naczynia"),
        o("D", "Ponieważ obliczono gęstość nasypową, uwzględniającą puste, wypełnione powietrzem przestrzenie między kryształkami"),
      ],
      correct: "D",
    },
  ],
};

const quizD3L01: Quiz = {
  questions: [
    {
      q: "Pod jakim kątem siła nacisku ZAWSZE działa na powierzchnię?",
      options: [
        o("A", "Pod kątem ostrym"),
        o("B", "Równolegle do powierzchni"),
        o("C", "Pod kątem prostym (prostopadle, 90 stopni)"),
      ],
      correct: "C",
    },
    {
      q: "Zgodnie ze wzorem na ciśnienie (p = F/S), dlaczego nadepnięcie boso na mały klocek tak bardzo boli w porównaniu do stanięcia na dużej płytce?",
      options: [
        o("A", "Ponieważ klocek w niewytłumaczalny sposób zwiększa naszą siłę grawitacji."),
        o("B", "Ponieważ nasza siła dzieli się przez bardzo małą powierzchnię, co generuje ogromne ciśnienie."),
        o("C", "Ponieważ duża płytka zmniejsza naszą masę, gdy na niej stoimy."),
      ],
      correct: "B",
    },
    {
      q: 'Co według poznanej na lekcji zasady oznacza stwierdzenie, że dane narzędzie (np. igła, nóż lub kły lisa) jest "ostre"?',
      options: [
        o("A", "Oznacza to, że narzędzie ma zminimalizowaną, bardzo małą powierzchnię styku."),
        o("B", "Oznacza to, że narzędzie potrafi wygenerować z siebie dodatkową siłę nacisku."),
        o("C", "Oznacza to, że działa ono z siłą równoległą do podłoża."),
      ],
      correct: "A",
    },
    {
      q: "Fizycy pakują Paskale w większe zestawy, aby łatwiej było je liczyć. Ile pojedynczych Paskali (klocków) znajdziemy w jednym Megapaskalu (MPa)?",
      options: [
        o("A", "Sto (100)"),
        o("B", "Tysiąc (1 000)"),
        o("C", "Milion (1 000 000)"),
      ],
      correct: "C",
    },
    {
      q: 'Jak brzmi najważniejsza reguła ("cheat code") zamiany małych centymetrów kwadratowych na duże metry kwadratowe?',
      options: [
        o("A", "Należy podzielić liczbę przez 100 (przesunąć przecinek o 2 miejsca w lewo)."),
        o("B", "Należy pomnożyć liczbę przez 1 000 (dodać 3 zera z prawej strony)."),
        o("C", "Należy podzielić liczbę przez 10 000 (przesunąć przecinek o 4 miejsca w lewo)."),
      ],
      correct: "C",
    },
  ],
};

const quizD3L02: Quiz = {
  questions: [
    {
      q: 'Jak fizycy nazywają "siłę nacisku" w przypadku cieczy i gazów (np. gdy woda naciska na dno akwarium)?',
      options: [
        o("A", "Parcie"),
        o("B", "Grawitacja"),
        o("C", "Wypór"),
      ],
      correct: "A",
    },
    {
      q: "Od czego zależy ciśnienie hydrostatyczne (wewnątrz cieczy) zgodnie ze wzorem p = d * g * h omówionym w tekście?",
      options: [
        o("A", "Od kształtu naczynia i szerokości dna"),
        o("B", "Od objętości i całkowitej masy płynu w zbiorniku"),
        o("C", "Od gęstości cieczy, grawitacji i głębokości (wysokości słupa wody)"),
      ],
      correct: "C",
    },
    {
      q: 'Na czym polega "paradoks hydrostatyczny" pokazany na przykładzie trzech akwariów o różnym kształcie?',
      options: [
        o("A", "Ciśnienie na dnie jest największe w najszerszym akwarium, bo znajduje się tam najwięcej wody."),
        o("B", "Szerokość i kształt naczynia nie mają znaczenia - przy tej samej głębokości ciśnienie na dnie każdego z nich jest identyczne."),
        o("C", "Woda wywiera największe ciśnienie wyłącznie w naczyniach zwężających się ku górze."),
      ],
      correct: "B",
    },
    {
      q: "Mamy dwie tuby wypełnione do tej samej wysokości: jedną wodą, a drugą ciężką rtęcią. Dlaczego rtęć wywiera większe ciśnienie na dno?",
      options: [
        o("A", "Ponieważ rtęć ma znacznie większą gęstość w porównaniu do lekkiej wody."),
        o("B", "Ponieważ na rtęć działa silniejsza grawitacja ziemska."),
        o("C", "Ponieważ cząsteczki rtęci są mniejsze i ciaśniej ułożone na dnie."),
      ],
      correct: "A",
    },
    {
      q: 'Jak zachowuje się ciśnienie atmosferyczne ("ocean powietrza"), gdy wspinamy się wysoko w góry, np. na Mount Everest?',
      options: [
        o("A", "Ciśnienie rośnie, bo powietrze wysoko w górach jest bardziej upakowane."),
        o("B", "Ciśnienie pozostaje bez zmian, wszędzie na Ziemi jest dokładnie takie samo."),
        o("C", "Ciśnienie maleje (im wyżej, tym niższe ciśnienie), ponieważ słup powietrza nad naszymi głowami jest po prostu krótszy."),
      ],
      correct: "C",
    },
  ],
};

const quizD3L03: Quiz = {
  questions: [
    {
      q: 'Jaka maszyna opisana na początku tekstu działa jak "super moc" i pozwala podnieść wielki ciężar używając do tego niewielkiej siły?',
      options: [
        o("A", "Winda osobowa"),
        o("B", "Prasa hydrauliczna"),
        o("C", "Turbina wodna"),
      ],
      correct: "B",
    },
    {
      q: "Co się dzieje z uwięzioną wewnątrz cieczą, gdy z zewnątrz naciśniemy mały tłok?",
      options: [
        o("A", "Ciśnienie rośnie dokładnie tak samo w całej objętości cieczy."),
        o("B", "Ciśnienie maleje na samym dnie urządzenia."),
        o("C", "Ciśnienie rośnie tylko w miejscu, gdzie znajduje się mały tłok."),
      ],
      correct: "A",
    },
    {
      q: "Zgodnie ze wzorem z tekstu, jaka jest relacja między ciśnieniem pod małym tłokiem (p1) a ciśnieniem pod dużym tłokiem (p2)?",
      options: [
        o("A", "Ciśnienie pod małym tłokiem jest dużo większe (p1 jest większe)."),
        o("B", "Ciśnienie pod dużym tłokiem jest dużo większe (p2 jest większe)."),
        o("C", "Ciśnienie po obu stronach jest po prostu identyczne (p1 równa się p2)."),
      ],
      correct: "C",
    },
    {
      q: 'Jak brzmi najważniejsza zasada z "czerwonego napisu na samym dole", decydująca o użyciu siły w prasie hydraulicznej?',
      options: [
        o("A", "Mniejsza powierzchnia potrzebuje mniejszej siły."),
        o("B", "Większa powierzchnia potrzebuje mniejszej siły."),
        o("C", "Wielkość powierzchni nie ma absolutnie żadnego znaczenia."),
      ],
      correct: "A",
    },
    {
      q: "Jakie trzy maszyny ułatwiające codzienne funkcjonowanie (wykorzystujące układ hydrauliczny) zostały wymienione na drugim slajdzie?",
      options: [
        o("A", "Strzykawka, ciśnieniomierz i waga samochodowa."),
        o("B", "Hamulec hydrauliczny, podnośnik hydrauliczny i prasa hydrauliczna."),
        o("C", "Amortyzator rowerowy, silnik spalinowy i wycieraczki samochodowe."),
      ],
      correct: "B",
    },
  ],
};

const quizD3L04: Quiz = {
  questions: [
    {
      q: "Jaki grecki uczony opisał zjawisko wyrywania się do góry przedmiotów wciśniętych pod wodę, nazywane dzisiaj siłą wyporu?",
      options: [
        o("A", "Arystoteles"),
        o("B", "Sokrates"),
        o("C", "Archimedes"),
      ],
      correct: "C",
    },
    {
      q: "Zgodnie z klockowym eksperymentem, jeśli woda wyparta z akwarium przez zanurzony klocek waży dokładnie 4 niutony, to z jaką siłą woda wypycha ten klocek w górę?",
      options: [
        o("A", "Z mniejszą siłą."),
        o("B", "Z dokładnie taką samą siłą (4 niutony)."),
        o("C", "Z dużo większą siłą."),
      ],
      correct: "B",
    },
    {
      q: "Co we wzorze na siłę wyporu (Fw = d * g * V) oznacza duża litera V?",
      options: [
        o("A", "Objętość tylko tej części klocka, która faktycznie jest zanurzona w wodzie."),
        o("B", "Całkowitą objętość akwarium, w którym przeprowadzamy eksperyment."),
        o("C", "Prędkość, z jaką klocek uderza w powierzchnię wody."),
      ],
      correct: "A",
    },
    {
      q: "Dlaczego jajko w klockowym eksperymencie opadło na dno w zwykłej wodzie, a w słodzonej/słonej unosiło się na powierzchni?",
      options: [
        o("A", "Słona woda wyłącza działanie grawitacji."),
        o("B", "Słona woda ma mniejszą gęstość, więc przedmioty stają się w niej lżejsze."),
        o("C", "Słona woda ma większą gęstość, a zasada mówi jasno: im większa gęstość, tym większa siła wyporu."),
      ],
      correct: "C",
    },
    {
      q: "Jakie słynne morze podano w tekście jako przykład miejsca, w którym woda jest tak gęsta i słona, że można położyć się na jej powierzchni jak na materacu?",
      options: [
        o("A", "Morze Martwe"),
        o("B", "Morze Bałtyckie"),
        o("C", "Morze Śródziemne"),
      ],
      correct: "A",
    },
  ],
};

const quizD3L05: Quiz = {
  questions: [
    {
      q: "Dlaczego w klockowym akwarium czerwony alkohol znalazł się na samej górze, nad żółtą oliwą i niebieską gliceryną?",
      options: [
        o("A", 'Ponieważ ma największą gęstość i jest "najcięższym zawodnikiem".'),
        o("B", 'Ponieważ ma najmniejszą gęstość i jest "najlżejszymi klockami" w zestawie.'),
        o("C", "Ponieważ jego cząsteczki są upakowane najciaśniej."),
        o("D", "Ponieważ działa na niego największa siła grawitacji."),
      ],
      correct: "B",
    },
    {
      q: 'Gdy drewniana kłoda unosi się spokojnie na powierzchni wody, oznacza to, że na naszym "fizycznym ringu":',
      options: [
        o("A", "Działa na nią tylko i wyłącznie siła wyporu."),
        o("B", "Siła grawitacji jest znacznie większa od siły wyporu."),
        o("C", "Siła grawitacji (ciągnąca w dół) i siła wyporu (pchająca w górę) są sobie idealnie równe (remis)."),
        o("D", "Woda nie stawia kłodzie żadnego oporu."),
      ],
      correct: "C",
    },
    {
      q: "Stalowy hantelek tonie i uderza o dno basenu, ponieważ:",
      options: [
        o("A", "Jego gęstość jest mniejsza niż gęstość wody."),
        o("B", "Siła wyporu pchająca w górę jest większa od siły grawitacji."),
        o("C", "Siła grawitacji ciągnąca w dół jest większa niż siła wyporu (Fg > Fb)."),
        o("D", "Stalowe klocki są ułożone znacznie luźniej niż cząsteczki wody."),
      ],
      correct: "C",
    },
    {
      q: "Co musi się stać, aby ciało (np. rybka lub okręt podwodny) idealnie lewitowało w samym środku wody, nie tonąc i nie wypływając na powierzchnię?",
      options: [
        o("A", "Siła grawitacji musi być równa sile wyporu (Fg = Fw)."),
        o("B", "Ciało musi mieć gęstość znacznie większą od gęstości wody."),
        o("C", "Siła grawitacji musi całkowicie zniknąć."),
        o("D", "Ciało musi być zbudowane z najcięższych możliwych klocków."),
      ],
      correct: "A",
    },
    {
      q: "W ramach śledztwa wrzuciliśmy szary głaz do dwóch cieczy. W cieczy o gęstości 1,5 głaz pływał, a w cieczy o gęstości 0,8 zatonął. Jaki z tego wniosek o gęstości głazu?",
      options: [
        o("A", "Gęstość głazu jest na pewno mniejsza niż 0,8."),
        o("B", "Gęstość głazu jest na pewno większa niż 1,5."),
        o("C", "Gęstość głazu wynosi dokładnie 0."),
        o("D", "Gęstość głazu jest większa niż 0,8, ale mniejsza niż 1,5."),
      ],
      correct: "D",
    },
  ],
};

// ── Dział 4 quizzes (single-choice; keys hidden until submit, per quiz UI) ────
const quizD4L01: Quiz = {
  questions: [
    {
      q: "Dlaczego według tekstu w fizyce nie ma czegoś takiego jak absolutny ruch?",
      options: [
        o("A", "Ponieważ pociągi poruszają się z różnymi prędkościami."),
        o("B", "Ponieważ wszystko zależy od wybranego na początku punktu odniesienia."),
        o("C", "Ponieważ każdy obiekt na Ziemi ostatecznie stoi w miejscu."),
        o("D", "Ponieważ peron zawsze porusza się względem pociągu."),
      ],
      correct: "B",
    },
    {
      q: "Jakie pytanie pozwala najłatwiej sprawdzić, czy jedno ciało porusza się względem drugiego?",
      options: [
        o("A", "Czy obiekty znajdują się w tym samym pojeździe?"),
        o("B", "Czy mają taką samą masę?"),
        o("C", "Czy odległość między nimi się zmienia?"),
        o("D", "Kto porusza się szybciej?"),
      ],
      correct: "C",
    },
    {
      q: "Ile liczb (współrzędnych) jest potrzebnych, aby namierzyć obiekt w pełnym układzie trójwymiarowym (3D), np. latający w niebie balon?",
      options: [
        o("A", "Jedna"),
        o("B", "Dwie"),
        o("C", "Trzy"),
        o("D", "Cztery"),
      ],
      correct: "C",
    },
    {
      q: "Jaka jest różnica między torem ruchu a drogą?",
      options: [
        o("A", "Tor to narysowany kształt śladu, a droga to jego mierzona długość."),
        o("B", "Tor to czas podróży, a droga to miejsce startu."),
        o("C", "Tor to mierzona odległość, a droga to wydeptana ścieżka."),
        o("D", "W fizyce tor i droga oznaczają dokładnie to samo."),
      ],
      correct: "A",
    },
    {
      q: "Piłka rzucona przez koszykarza wpada do obręczy wygiętym łukiem. Jaki to rodzaj ruchu?",
      options: [
        o("A", "Ruch prostoliniowy"),
        o("B", "Ruch krzywoliniowy"),
        o("C", "Spoczynek względny"),
        o("D", "Ruch jednowymiarowy"),
      ],
      correct: "B",
    },
  ],
};

const quizD4L02: Quiz = {
  questions: [
    {
      q: 'Co to znaczy, że ruch jest "jednostajny"?',
      options: [
        o("A", "Auto pokonuje różne odległości w zależności od czasu podróży."),
        o("B", "W takich samych odstępach czasu pojazd pokonuje dokładnie te same odległości."),
        o("C", "Samochód cały czas przyspiesza na prostej drodze."),
        o("D", "Prędkość auta zmienia się co kilka sekund."),
      ],
      correct: "B",
    },
    {
      q: "Co oznaczają litery we wzorze na prędkość v = s / t?",
      options: [
        o("A", "v to czas, s to prędkość, t to droga"),
        o("B", "v to droga, s to czas, t to prędkość"),
        o("C", "v to prędkość, s to droga, t to czas"),
        o("D", "v to przyspieszenie, s to droga, t to czas"),
      ],
      correct: "C",
    },
    {
      q: "Jak zamienić wielkie jednostki (kilometry na godzinę) na mniejsze (metry na sekundę)?",
      options: [
        o("A", "Należy pomnożyć wynik przez 3,6"),
        o("B", "Należy podzielić wynik przez 3,6"),
        o("C", "Należy pomnożyć wynik przez 10"),
        o("D", "Należy podzielić wynik przez 10"),
      ],
      correct: "B",
    },
    {
      q: "Ile wynosi przyspieszenie w ruchu jednostajnym prostoliniowym (np. podczas jazdy z włączonym tempomatem)?",
      options: [
        o("A", "Jest zawsze większe od zera"),
        o("B", "Stale rośnie w miarę upływu czasu"),
        o("C", "Zależy od długości trasy"),
        o("D", "Wynosi równe zero"),
      ],
      correct: "D",
    },
  ],
};

export const COURSE: {
  title: string;
  slug: string;
  description: string;
  sections: SectionDef[];
} = {
  title: "Łatwa Fizyka — klasa 7",
  slug: "latwa-fizyka",
  description:
    "Kompletny kurs fizyki dla klasy 7: trzy działy, 21 lekcji wideo, ćwiczenia i quizy. Ucz się we własnym tempie z filmami, materiałami pomocniczymi i asystentem AI przy każdej lekcji.",
  sections: [
    {
      title: "Dział 1 — podstawy fizyki",
      slug: "dzial-1",
      sortOrder: 1,
      bunnyCollectionId: "76622699-49f9-4827-8eb9-b17701caf854",
      lessons: [
        { code: "D1_L01", title: "Podstawy fizyki — ciało, substancja, obserwacja i eksperyment", slug: "lekcja-01", sortOrder: 1, isPreview: true, quiz: quizD1L01 },
        { code: "D1_L02", title: "Pomiary, wielkości fizyczne i jednostki SI", slug: "lekcja-02", sortOrder: 2, quiz: quizD1L02 },
        { code: "D1_L03", title: "Niepewność pomiaru, średnia i zaokrąglanie", slug: "lekcja-03", sortOrder: 3, quiz: quizD1L03 },
        { code: "D1_L04", title: "Oddziaływania — grawitacja, elektrostatyka i magnetyzm", slug: "lekcja-04", sortOrder: 4, quiz: quizD1L04 },
        { code: "D1_L05", title: "Siła, niuton i wektor siły", slug: "lekcja-05", sortOrder: 5, quiz: quizD1L05 },
        { code: "D1_L06", title: "Utrwalenie — materiały filmowe", slug: "lekcja-06", sortOrder: 6 },
      ],
    },
    {
      title: "Dział 2 — właściwości materii",
      slug: "dzial-2",
      sortOrder: 2,
      bunnyCollectionId: "8cd03b14-9792-41b5-9380-a18da5fc8502",
      lessons: [
        { code: "D2_L00", title: "Wprowadzenie do właściwości materii", slug: "lekcja-00", sortOrder: 0 },
        { code: "D2_L01", title: "Materia i budowa substancji", slug: "lekcja-01", sortOrder: 1 },
        { code: "D2_L02", title: "Atomy, cząsteczki, dyfuzja i napięcie powierzchniowe", slug: "lekcja-02", sortOrder: 2, quiz: quizD2L02 },
        { code: "D2_L03", title: "Film główny — właściwości materii", slug: "lekcja-03", sortOrder: 3 },
        { code: "D2_L04", title: "Stany skupienia i właściwości ciał", slug: "lekcja-04", sortOrder: 4, quiz: quizD2L04 },
        { code: "D2_L05", title: "Filmy i materiał pomocniczy", slug: "lekcja-05", sortOrder: 5 },
        { code: "D2_L06", title: "Masa, ciężar i jednostki", slug: "lekcja-06", sortOrder: 6, quiz: quizD2L06 },
        { code: "D2_L07", title: "Sekwencja filmów i obrazów pomocniczych", slug: "lekcja-07", sortOrder: 7 },
        { code: "D2_L08", title: "Gęstość i objętość", slug: "lekcja-08", sortOrder: 8, quiz: quizD2L08 },
      ],
    },
    {
      title: "Dział 3 — hydrostatyka i aerostatyka",
      slug: "dzial-3",
      sortOrder: 3,
      bunnyCollectionId: "10dfd152-f817-404b-b015-db08cf2affb3",
      lessons: [
        { code: "D3_L00", title: "Wprowadzenie do hydrostatyki", slug: "lekcja-00", sortOrder: 0 },
        { code: "D3_L01", title: "Ciśnienie i siła nacisku", slug: "lekcja-01", sortOrder: 1, quiz: quizD3L01 },
        { code: "D3_L02", title: "Parcie, ciśnienie hydrostatyczne i atmosferyczne", slug: "lekcja-02", sortOrder: 2, quiz: quizD3L02 },
        { code: "D3_L03", title: "Prasa hydrauliczna i prawo Pascala", slug: "lekcja-03", sortOrder: 3, quiz: quizD3L03 },
        { code: "D3_L04", title: "Siła wyporu i prawo Archimedesa", slug: "lekcja-04", sortOrder: 4, quiz: quizD3L04 },
        { code: "D3_L05", title: "Pływanie, tonięcie i gęstość", slug: "lekcja-05", sortOrder: 5, quiz: quizD3L05 },
      ],
    },
    {
      title: "Dział 4",
      slug: "dzial-4",
      sortOrder: 4,
      bunnyCollectionId: "47ce0c3d-d330-40e6-b734-d4a38f964dff",
      lessons: [
        {
          code: "D4_L01",
          title: "Względność ruchu, układ odniesienia, układ współrzędnych, tor i droga",
          slug: "lekcja-01",
          sortOrder: 1,
          quiz: quizD4L01,
          videos: [
            { file: "D4_L01_01_VIDEO_ScreenRecorderProject86.mkv", title: "Materiał główny lekcji 1", sortOrder: 1 },
          ],
        },
        {
          code: "D4_L02",
          title: "Ruch jednostajny prostoliniowy - prędkość, droga i czas",
          slug: "lekcja-02",
          sortOrder: 2,
          quiz: quizD4L02,
          videos: [
            { file: "D4_L02_01_VIDEO_ScreenRecorderProject87.mkv", title: "Materiał główny lekcji 2", sortOrder: 1 },
            { file: "D4_L02_03_VIDEO_ScreenRecorderProject86.mkv", title: "Przykład rozwiązany: droga motocyklisty", sortOrder: 3 },
            { file: "D4_L02_05_VIDEO_ScreenRecorderProject87.mkv", title: "Przykład rozwiązany: prędkość autokaru", sortOrder: 5 },
          ],
          images: [
            {
              file: "D4_L02_04_PNG_ZADANIE_DROGA_SAMOCHOD_15MIN_60KMH.png",
              alt: "Oblicz drogę, jaką pokona samochód w ciągu 15 minut, jeżeli porusza się ze stałą prędkością 60 km/h.",
              answer: "15 km",
              solution: "15 min = 0,25 h; s = v·t = 60 km/h · 0,25 h = 15 km.",
              relatedVideo: "D4_L02_03_VIDEO_ScreenRecorderProject86.mkv",
              sortOrder: 4,
            },
            {
              file: "D4_L02_06_PNG_ZADANIE_PREDKOSC_POCIAG_360KM_4H.png",
              alt: "Oblicz prędkość pociągu, który jadąc ruchem jednostajnym, w ciągu 4 godzin przebył drogę 360 km.",
              answer: "90 km/h",
              solution: "v = s/t = 360 km / 4 h = 90 km/h.",
              relatedVideo: "D4_L02_05_VIDEO_ScreenRecorderProject87.mkv",
              sortOrder: 6,
            },
          ],
        },
        {
          code: "D4_L03",
          title: "Ruch jednostajnie przyspieszony - przyspieszenie, zmiana prędkości i droga",
          slug: "lekcja-03",
          sortOrder: 3,
          videos: [
            { file: "D4_L03_01_VIDEO_ScreenRecorderProject87.mkv", title: "Materiał główny lekcji 3", sortOrder: 1 },
            { file: "D4_L03_02_VIDEO_ScreenRecorderProject88.mkv", title: "Przykład rozwiązany: przyspieszenie samochodu", sortOrder: 2 },
            { file: "D4_L03_04_VIDEO_ScreenRecorderProject89.mkv", title: "Przykład rozwiązany: przyrost prędkości wyścigówki", sortOrder: 4 },
            { file: "D4_L03_06_VIDEO_ScreenRecorderProject90.mkv", title: "Przykład rozwiązany: przyspieszenie hulajnogi", sortOrder: 6 },
            { file: "D4_L03_08_VIDEO_ScreenRecorderProject91.mkv", title: "Przykład rozwiązany: droga deskorolki", sortOrder: 8 },
          ],
          images: [
            {
              file: "D4_L03_03_PNG_ZADANIE_PRZYSPIESZENIE_MOTOCYKLISTA_36_72KMH.png",
              alt: "Podczas wyprzedzania motocyklista zwiększył swoją prędkość w stałym tempie od 36 km/h do 72 km/h. Cały manewr trwał 5 sekund. Oblicz przyspieszenie tego motocykla. Wynik podaj w m/s².",
              answer: "2 m/s²",
              solution: "36 km/h = 10 m/s; 72 km/h = 20 m/s; a = (20 - 10) / 5 = 2 m/s².",
              relatedVideo: "D4_L03_02_VIDEO_ScreenRecorderProject88.mkv",
              sortOrder: 3,
            },
            {
              file: "D4_L03_05_PNG_ZADANIE_PRZYROST_PREDKOSCI_MOTOCYKL_4MS2.png",
              alt: "Oblicz, o ile wzrosła prędkość motocykla poruszającego się ze stałym przyspieszeniem 4 m/s²: a) w piątej sekundzie ruchu; b) w ciągu pierwszych pięciu sekund ruchu.",
              answer: "a) 4 m/s; b) 20 m/s",
              solution: "W każdej sekundzie prędkość rośnie o 4 m/s. W ciągu 5 s: Δv = a·t = 4·5 = 20 m/s.",
              relatedVideo: "D4_L03_04_VIDEO_ScreenRecorderProject89.mkv",
              sortOrder: 5,
            },
            {
              file: "D4_L03_07_PNG_ZADANIE_PRZYSPIESZENIE_ROWERZYSTA_18KMH.png",
              alt: "Oblicz przyspieszenie rowerzysty, który ruszając z miejsca, w ciągu 5 sekund osiągnął prędkość 18 km/h. Wynik podaj w m/s².",
              answer: "1 m/s²",
              solution: "18 km/h = 5 m/s; a = 5/5 = 1 m/s².",
              relatedVideo: "D4_L03_06_VIDEO_ScreenRecorderProject90.mkv",
              sortOrder: 7,
            },
            {
              file: "D4_L03_09_PNG_ZADANIE_DROGA_ROBOT_2MS2_5S.png",
              alt: "Robot kuchenny na kołach (zabawka) rusza z miejsca ze stałym przyspieszeniem 2 m/s². Oblicz, jaką drogę pokona ten robot w ciągu 5 s ruchu.",
              answer: "25 m",
              solution: "s = 1/2·a·t² = 1/2·2·5² = 25 m.",
              relatedVideo: "D4_L03_08_VIDEO_ScreenRecorderProject91.mkv",
              sortOrder: 9,
            },
          ],
        },
        {
          code: "D4_L04",
          title: "Odczytywanie wykresów ruchu v(t), s(t) i a(t)",
          slug: "lekcja-04",
          sortOrder: 4,
          videos: [
            { file: "D4_L04_01_VIDEO_ScreenRecorderProject86.mkv", title: "Materiał główny lekcji 4 - część 1 nagrania 04.05", sortOrder: 1 },
          ],
        },
        {
          code: "D4_L05",
          title: "Zadania z wykresów ruchu",
          slug: "lekcja-05",
          sortOrder: 5,
          videos: [
            { file: "D4_L05_01_VIDEO_ScreenRecorderProject86.mkv", title: "Materiał główny lekcji 5 - część 2 nagrania 04.05", sortOrder: 1 },
          ],
        },
      ],
    },
  ],
};

// Board (whiteboard) task per lesson, keyed by lesson code. Every lesson has a
// drawable, AI-checkable task so the interactive tablica appears on each lesson.
// Consumed by seed.ts (fresh seed) and backfill-tasks.ts (non-destructive).
export const BOARD_TASKS_BY_CODE: Record<string, { title: string; description: string }> = {
  // Dział 1 — podstawy fizyki
  D1_L01: {
    title: "Zadanie: ciało fizyczne czy substancja?",
    description:
      "Na tablicy narysuj tabelę z dwiema kolumnami: „Ciało fizyczne” oraz „Substancja”. Wpisz do właściwych kolumn: gwóźdź, żelazo, szklanka, szkło, kostka lodu, woda. Pod tabelą napisz jednym zdaniem, czym różni się ciało fizyczne od substancji.",
  },
  D1_L02: {
    title: "Zadanie: wielkości fizyczne i jednostki SI",
    description:
      "Narysuj na tablicy tabelę z trzema kolumnami: „Wielkość fizyczna”, „Symbol” oraz „Jednostka SI”. Uzupełnij ją dla długości, masy, czasu i temperatury. Pod tabelą zamień jednostki: ile to jest 2,5 km w metrach oraz 3000 g w kilogramach?",
  },
  D1_L03: {
    title: "Zadanie: średnia z pomiarów",
    description:
      "Uczeń zmierzył długość ołówka trzy razy i otrzymał: 15,2 cm, 15,4 cm oraz 15,3 cm. Oblicz wartość średnią pomiaru. Zapisz wzór na średnią arytmetyczną, podstaw dane i podaj wynik zaokrąglony do jednego miejsca po przecinku, z jednostką.",
  },
  D1_L04: {
    title: "Zadanie: rodzaje oddziaływań",
    description:
      "Narysuj trzy sytuacje i podpisz, jaki rodzaj oddziaływania w nich występuje (grawitacyjne, elektrostatyczne, magnetyczne): spadające jabłko, naelektryzowana linijka przyciągająca skrawki papieru oraz magnes przyciągający gwóźdź. Przy każdej sytuacji zaznacz strzałką zwrot siły.",
  },
  D1_L05: {
    title: "Zadanie: wektor siły wypadkowej",
    description:
      "Na sanki działają dwie poziome siły: Tomek ciągnie w prawo siłą 30 N, a Ola w lewo siłą 18 N. Narysuj obie siły jako wektory (zachowaj proporcje długości) i zaznacz wektor siły wypadkowej. Podaj wartość oraz zwrot siły wypadkowej.",
  },
  D1_L06: {
    title: "Zadanie powtórkowe: mapa pojęć działu 1",
    description:
      "Narysuj mapę myśli z hasłem głównym „Podstawy fizyki” i co najmniej czterema gałęziami (np. wielkości fizyczne, jednostki SI, pomiar i niepewność, oddziaływania i siła). Do każdej gałęzi dopisz jeden przykład lub wzór.",
  },
  // Dział 2 — właściwości materii
  D2_L00: {
    title: "Zadanie: właściwości materii",
    description:
      "Narysuj tabelę z dwiema kolumnami: „Właściwość materii” oraz „Przykład z życia”. Wpisz co najmniej cztery właściwości (np. masa, objętość, gęstość, twardość) i do każdej dopisz jeden przykład.",
  },
  D2_L01: {
    title: "Zadanie: ułożenie drobin w trzech stanach skupienia",
    description:
      "Narysuj, jak rozmieszczone są drobiny (cząsteczki) w ciele stałym, w cieczy i w gazie. Podpisz każdy rysunek i napisz jednym zdaniem, czym różni się układ drobin w tych trzech stanach.",
  },
  D2_L02: {
    title: "Zadanie: dyfuzja w wodzie",
    description:
      "Narysuj szklankę z wodą, do której wpuszczono kroplę atramentu, w trzech momentach: zaraz po wpuszczeniu, po chwili oraz po dłuższym czasie. Podpisz rysunki i wyjaśnij jednym zdaniem, na czym polega zjawisko dyfuzji.",
  },
  D2_L03: {
    title: "Zadanie: jedna substancja w trzech stanach",
    description:
      "Narysuj wodę w trzech stanach skupienia: stałym (lód), ciekłym (woda) i gazowym (para wodna). Pod każdym rysunkiem podpisz nazwę stanu oraz napisz, czy ma on stały kształt i stałą objętość.",
  },
  D2_L04: {
    title: "Zadanie: przemiany stanów skupienia",
    description:
      "Narysuj schemat przemian: ciało stałe → ciecz → gaz oraz przemiany odwrotne. Podpisz wszystkie strzałki nazwami przemian (topnienie, krzepnięcie, parowanie, skraplanie).",
  },
  D2_L05: {
    title: "Zadanie powtórkowe: ciało stałe, ciecz i gaz",
    description:
      "Narysuj tabelę z trzema kolumnami (ciało stałe, ciecz, gaz) i trzema wierszami: kształt, objętość, ściśliwość. Uzupełnij każdą komórkę krótką informacją.",
  },
  D2_L06: {
    title: "Zadanie: oblicz ciężar ciała",
    description:
      "Oblicz ciężar plecaka o masie 5 kg. Przyjmij g = 10 N/kg. Zapisz wzór (Fc = m · g), podstaw dane i podaj wynik z jednostką. Na rysunku zaznacz zwrot wektora ciężaru.",
  },
  D2_L07: {
    title: "Zadanie powtórkowe: masa a ciężar",
    description:
      "Narysuj ciało zawieszone na siłomierzu i zaznacz strzałką wektor ciężaru. Pod rysunkiem napisz, czym różni się masa od ciężaru oraz w jakich jednostkach podajemy każdą z tych wielkości.",
  },
  D2_L08: {
    title: "Zadanie: oblicz gęstość metalu",
    description:
      "Bryłka metalu ma masę 270 g i objętość 100 cm³. Oblicz jej gęstość. Zapisz wzór (ρ = m / V), podstaw dane i podaj wynik w g/cm³. Zapisz, jaki to może być metal.",
  },
  // Dział 3 — hydrostatyka i aerostatyka
  D3_L00: {
    title: "Zadanie: ciśnienie cieczy a głębokość",
    description:
      "Narysuj naczynie z wodą i zaznacz w nim trzy punkty na różnych głębokościach. Strzałkami pokaż, gdzie ciśnienie cieczy jest największe, a gdzie najmniejsze. Pod rysunkiem napisz, od czego zależy ciśnienie hydrostatyczne.",
  },
  D3_L01: {
    title: "Zadanie: oblicz ciśnienie",
    description:
      "Klocek naciska na stół siłą 60 N, a pole jego podstawy wynosi 0,02 m². Oblicz ciśnienie, jakie klocek wywiera na stół. Zapisz wzór (p = F / S), podstaw dane i podaj wynik w paskalach (Pa).",
  },
  D3_L02: {
    title: "Zadanie: oblicz ciśnienie hydrostatyczne",
    description:
      "Oblicz ciśnienie hydrostatyczne na głębokości 2 m w wodzie. Przyjmij ρ = 1000 kg/m³ oraz g = 10 N/kg. Zapisz wzór (p = ρ · g · h), podstaw dane i podaj wynik w paskalach (Pa).",
  },
  D3_L03: {
    title: "Zadanie: prasa hydrauliczna",
    description:
      "Narysuj prasę hydrauliczną z dwoma tłokami o różnych polach powierzchni. Na mały tłok o polu 0,01 m² działa siła 50 N. Oblicz ciśnienie przekazywane w cieczy (p = F / S) i zaznacz strzałkami, jak przenosi się ono na większy tłok.",
  },
  D3_L04: {
    title: "Zadanie: siła wyporu",
    description:
      "Kamień o objętości 0,001 m³ zanurzono całkowicie w wodzie (ρ = 1000 kg/m³, g = 10 N/kg). Oblicz siłę wyporu działającą na kamień. Zapisz wzór (Fw = ρ · g · V), podstaw dane i podaj wynik w niutonach. Narysuj zwrot siły wyporu.",
  },
  D3_L05: {
    title: "Zadanie: pływa czy tonie?",
    description:
      "Narysuj naczynie z wodą (ρ = 1000 kg/m³) i umieść w nim trzy ciała o gęstościach 700 kg/m³, 1000 kg/m³ oraz 2700 kg/m³. Zaznacz, które ciało pływa na powierzchni, które unosi się zanurzone, a które tonie. Uzasadnij, porównując gęstości ciał z gęstością wody.",
  },
};
