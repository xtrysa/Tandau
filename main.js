import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';

// Main App component
function App() {
    // State variables for Firebase and user authentication
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // State variables for navigation and app data
    const [currentPage, setCurrentPage] = useState('home'); // 'home', 'test', 'chat', 'results'
    const [testResults, setTestResults] = useState({});
    const [chatHistory, setChatHistory] = useState([]);
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [showProfessionDetailModal, setShowProfessionDetailModal] = useState(false);
    const [selectedProfessionDescription, setSelectedProfessionDescription] = useState('');
    const [selectedProfessionName, setSelectedProfessionName] = useState('');
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [selectedResultCategory, setSelectedResultCategory] = useState(null); // New state for selected category


    const chatContainerRef = useRef(null); // Ref for scrolling chat to bottom

    // Firebase Initialization and Authentication
    useEffect(() => {
        try {
            // Retrieve Firebase config and app ID from global variables
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            if (Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is not defined. Please ensure __firebase_config is set.");
                setModalMessage("Ошибка инициализации: Конфигурация Firebase не найдена.");
                setShowModal(true);
                return;
            }

            // Initialize Firebase app
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Listen for authentication state changes
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    // User is signed in
                    setUserId(user.uid);
                } else {
                    // User is signed out, sign in anonymously if no token provided
                    if (typeof __initial_auth_token === 'undefined') {
                        await signInAnonymously(firebaseAuth);
                    }
                }
                setIsAuthReady(true); // Auth state is ready
            });

            // Sign in with custom token if available
            if (typeof __initial_auth_token !== 'undefined') {
                signInWithCustomToken(firebaseAuth, __initial_auth_token)
                    .catch((error) => {
                        console.error("Error signing in with custom token:", error);
                        setModalMessage(`Ошибка входа: ${error.message}`);
                        setShowModal(true);
                    });
            }

            return () => unsubscribe(); // Cleanup auth listener on unmount
        } catch (error) {
            console.error("Error during Firebase initialization:", error);
            setModalMessage(`Ошибка инициализации Firebase: ${error.message}`);
            setShowModal(true);
        }
    }, []);

    // Fetch user data from Firestore when auth is ready and userId is available
    useEffect(() => {
        if (db && userId && isAuthReady) {
            const userDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/tandau_results`, 'careerPlan');
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTestResults(data.testResults || {});
                    setChatHistory(data.chatHistory || []);
                    setRecommendations(data.recommendations || null);
                    // Set default selected category if recommendations exist and no category is selected yet
                    if (data.recommendations && !selectedResultCategory) {
                        // Find the first category that has data
                        const categories = ['professions', 'universities', 'courses', 'internships', 'individualPlan'];
                        for (const category of categories) {
                            if (category === 'universities' || category === 'internships') {
                                if (data.recommendations[category]?.local?.length > 0 || data.recommendations[category]?.international?.length > 0 || data.recommendations[category]?.all?.length > 0) {
                                    setSelectedResultCategory(category);
                                    break;
                                }
                            } else if (data.recommendations[category]?.length > 0) {
                                setSelectedResultCategory(category);
                                break;
                            }
                        }
                    }
                } else {
                    // Document doesn't exist, initialize with empty data
                    setTestResults({});
                    setChatHistory([]);
                    setRecommendations(null);
                    setSelectedResultCategory(null);
                }
            }, (error) => {
                console.error("Error fetching user data:", error);
                setModalMessage(`Ошибка при загрузке данных: ${error.message}`);
                setShowModal(true);
            });

            return () => unsubscribe(); // Cleanup snapshot listener
        }
    }, [db, userId, isAuthReady, selectedResultCategory]); // Added selectedResultCategory to dependencies

    // Scroll chat to bottom when chatHistory changes
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    // Function to save data to Firestore
    const saveData = async (dataToSave) => {
        if (!db || !userId) {
            console.warn("Firestore not initialized or userId not available. Cannot save data.");
            return;
        }
        try {
            const userDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/tandau_results`, 'careerPlan');
            await setDoc(userDocRef, dataToSave, { merge: true });
            console.log("Data saved successfully!");
        } catch (error) {
            console.error("Error saving data:", error);
            setModalMessage(`Ошибка при сохранении данных: ${error.message}`);
            setShowModal(true);
        }
    };

    // --- Test Component Logic ---
    const questions = [
        {
            id: 'interest',
            question: 'Что вас больше всего интересует?',
            options: [
                { value: 'tech', label: 'Технологии и инновации' },
                { value: 'creative', label: 'Искусство и творчество' },
                { value: 'social', label: 'Помощь людям и обществу' },
                { value: 'business', label: 'Бизнес и предпринимательство' },
                { value: 'science', label: 'Наука и исследования' },
            ],
        },
        {
            id: 'work_environment',
            question: 'Какая рабочая обстановка вам ближе?',
            options: [
                { value: 'office', label: 'Офис, стабильный график' },
                { value: 'flexible', label: 'Гибкий график, удаленная работа' },
                { value: 'field', label: 'Работа на выезде, с людьми' },
                { value: 'lab', label: 'Лаборатория, исследовательская деятельность' },
                { value: 'studio', label: 'Творческая студия, мастерская' },
            ],
        },
        {
            id: 'skills',
            question: 'Какие из этих навыков вы хотели бы развивать?',
            options: [
                { value: 'coding', label: 'Программирование, анализ данных' },
                { value: 'design', label: 'Дизайн, рисование, музыка' },
                { value: 'communication', label: 'Общение, переговоры, лидерство' },
                { value: 'problem_solving', label: 'Решение сложных задач, критическое мышление' },
                { value: 'research', label: 'Исследования, эксперименты' },
            ],
        },
        {
            id: 'goals',
            question: 'Какова ваша главная карьерная цель?',
            options: [
                { value: 'impact', label: 'Влиять на мир, создавать что-то новое' },
                { value: 'stability', label: 'Стабильность и хороший доход' },
                { value: 'creativity', label: 'Реализовать свой творческий потенциал' },
                { value: 'help', label: 'Помогать другим, приносить пользу' },
                { value: 'learn', label: 'Постоянно учиться и развиваться' },
            ],
        },
        {
            id: 'learning_style',
            question: 'Как вы предпочитаете учиться?',
            options: [
                { value: 'practical', label: 'Через практику и проекты' },
                { value: 'theory', label: 'Через чтение и лекции' },
                { value: 'collaboration', label: 'В группах и обсуждениях' },
                { value: 'self_study', label: 'Самостоятельно, в своем темпе' },
            ],
        },
        {
            id: 'challenge_level',
            question: 'Насколько сложными должны быть задачи, чтобы они вас мотивировали?',
            options: [
                { value: 'easy', label: 'Легкие, чтобы быстро видеть результат' },
                { value: 'moderate', label: 'Умеренно сложные, с возможностью роста' },
                { value: 'challenging', label: 'Очень сложные, требующие максимальных усилий' },
            ],
        },
        {
            id: 'social_interaction',
            question: 'Насколько важен для вас уровень социального взаимодействия в работе?',
            options: [
                { value: 'high', label: 'Высокий, люблю работать с людьми' },
                { value: 'medium', label: 'Средний, баланс между общением и индивидуальной работой' },
                { value: 'low', label: 'Низкий, предпочитаю сосредоточиться на задачах в одиночку' },
            ],
        },
        {
            id: 'innovation_desire',
            question: 'Насколько важно для вас внедрять инновации и работать с новыми технологиями?',
            options: [
                { value: 'very_important', label: 'Очень важно, хочу быть на передовой' },
                { value: 'somewhat_important', label: 'Достаточно важно, но не критично' },
                { value: 'not_important', label: 'Не так важно, главное — стабильность' },
            ],
        },
    ];

    const handleTestAnswer = (questionId, value) => {
        setTestResults((prev) => ({ ...prev, [questionId]: value }));
    };

    const startAIChat = () => {
        setCurrentPage('chat');
        saveData({ testResults }); // Save test results before starting chat
        // Initial prompt for AI based on test results
        const initialPrompt = `Я прошел профориентационный тест. Мои результаты: ${JSON.stringify(testResults)}. Помоги мне выбрать профессию и составить карьерный план.
В первую очередь, пожалуйста, уточни, в каком городе вы проживаете?
После этого задавай только самые важные уточняющие вопросы, чтобы лучше понять мои интересы и цели.
В конце диалога, пожалуйста, предоставь рекомендации по следующим категориям. Каждый пункт в списках должен быть кратким (1-2 предложения) и информативным, как отдельная карточка, без использования символов жирного шрифта (например, **).
Используй следующие четкие заголовки для разделения информации:
'Профессии:
- [Название профессии 1]: [Краткое описание]
- [Название профессии 2]: [Краткое описание]
Вузы:
- Местные вузы:
  - [Название ВУЗа 1], [Город]: [Краткое описание]
  - [Название ВУЗа 2], [Город]: [Краткое описание]
- Международные вузы:
  - [Название ВУЗа 3], [Страна]: [Краткое описание]
Онлайн-курсы:
- [Название курса 1]: [Краткое описание]
- [Название курса 2]: [Краткое описание]
Стажировки:
- Местные стажировки:
  - [Название стажировки 1], [Город]: [Краткое описание]
- Международные стажировки:
  - [Название стажировки 2], [Страна]: [Краткое описание]
Индивидуальный план:
- [Пункт плана 1]: [Краткое описание]
- [Пункт плана 2]: [Краткое описание]'
`;
        sendToAI(initialPrompt);
    };

    // --- AI Chat Logic ---
    const sendToAI = async (message) => {
        setIsLoading(true);
        const newChatHistory = [...chatHistory, { role: 'user', parts: [{ text: message }] }];
        setChatHistory(newChatHistory);
        saveData({ chatHistory: newChatHistory }); // Save updated chat history

        try {
            const apiKey = ""; // Canvas will provide this at runtime
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const payload = {
                contents: newChatHistory.map(msg => ({ role: msg.role, parts: msg.parts })),
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const aiResponseText = result.candidates[0].content.parts[0].text;
                const updatedChatHistory = [...newChatHistory, { role: 'model', parts: [{ text: aiResponseText }] }];
                setChatHistory(updatedChatHistory);
                saveData({ chatHistory: updatedChatHistory }); // Save updated chat history

                // Attempt to parse structured recommendations from AI response
                parseAIResponseForRecommendations(aiResponseText);

            } else {
                console.error("Unexpected AI response structure:", result);
                const errorMessage = "Извините, я не смог получить ответ от ИИ. Пожалуйста, попробуйте еще раз.";
                const updatedChatHistory = [...newChatHistory, { role: 'model', parts: [{ text: errorMessage }] }];
                setChatHistory(updatedChatHistory);
                saveData({ chatHistory: updatedChatHistory });
            }
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            const errorMessage = `Произошла ошибка при обращении к ИИ: ${error.message}. Пожалуйста, попробуйте позже.`;
            const updatedChatHistory = [...newChatHistory, { role: 'model', parts: [{ text: errorMessage }] }];
            setChatHistory(updatedChatHistory);
            saveData({ chatHistory: updatedChatHistory });
            setModalMessage(`Ошибка ИИ: ${error.message}`);
            setShowModal(true);
        } finally {
            setIsLoading(false);
        }
    };

    const parseAIResponseForRecommendations = (responseText) => {
        const newRecommendations = {};

        // Helper to extract items under a specific heading, optionally with sub-headings
        const extractItems = (text, heading, nextHeadingRegex) => {
            const match = text.match(new RegExp(`${heading}:\\s*([\\s\\S]*?)(?:${nextHeadingRegex}|$)`, 'i'));
            if (match) {
                // Remove markdown bolding from extracted items
                return match[1].trim().split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, ''));
            }
            return [];
        };

        // Professions
        newRecommendations.professions = extractItems(responseText, "Профессии", "Вузы|Онлайн-курсы|Стажировки|Индивидуальный план");

        // Universities (with local/international parsing)
        const universitiesText = extractItems(responseText, "Вузы", "Онлайн-курсы|Стажировки|Индивидуальный план").join('\n');
        const localUniversitiesMatch = universitiesText.match(/Местные вузы:\s*([\s\S]*?)(?:Международные вузы:|$)/i);
        const internationalUniversitiesMatch = universitiesText.match(/Международные вузы:\s*([\s\S]*)/i);

        newRecommendations.universities = {
            local: localUniversitiesMatch ? localUniversitiesMatch[1].trim().split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, '')) : [],
            international: internationalUniversitiesMatch ? internationalUniversitiesMatch[1].trim().split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, '')) : [],
            // Fallback if no specific local/international headings are found
            all: (!localUniversitiesMatch && !internationalUniversitiesMatch) ? universitiesText.split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, '')) : []
        };


        // Online Courses
        newRecommendations.courses = extractItems(responseText, "Онлайн-курсы", "Стажировки|Индивидуальный план");

        // Internships (with local/international parsing)
        const internshipsText = extractItems(responseText, "Стажировки", "Индивидуальный план").join('\n');
        const localInternshipsMatch = internshipsText.match(/Местные стажировки:\s*([\s\S]*?)(?:Международные стажировки:|$)/i);
        const internationalInternshipsMatch = internshipsText.match(/Международные стажировки:\s*([\s\S]*)/i);

        newRecommendations.internships = {
            local: localInternshipsMatch ? localInternshipsMatch[1].trim().split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, '')) : [],
            international: internationalInternshipsMatch ? internationalInternshipsMatch[1].trim().split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, '')) : [],
            // Fallback if no specific local/international headings are found
            all: (!localInternshipsMatch && !internationalInternshipsMatch) ? internshipsText.split('\n').filter(line => line.trim() !== '').map(item => item.replace(/\*\*/g, '')) : []
        };

        // Individual Plan
        newRecommendations.individualPlan = extractItems(responseText, "Индивидуальный план", "$");

        if (Object.keys(newRecommendations).length > 0) {
            setRecommendations(newRecommendations);
            saveData({ recommendations: newRecommendations });
        }
    };

    const finishChatAndShowResults = () => {
        setCurrentPage('results');
        if (recommendations) {
            // Set default selected category to the first one that has data
            const categories = ['professions', 'universities', 'courses', 'internships', 'individualPlan'];
            for (const category of categories) {
                if (category === 'universities' || category === 'internships') {
                    if (recommendations[category]?.local?.length > 0 || recommendations[category]?.international?.length > 0 || recommendations[category]?.all?.length > 0) {
                        setSelectedResultCategory(category);
                        break;
                    }
                } else if (recommendations[category]?.length > 0) {
                    setSelectedResultCategory(category);
                    break;
                }
            }
        }
    };

    // --- Gemini API for Profession Description ---
    const generateProfessionDescription = async (professionName) => {
        setIsGeneratingDescription(true);
        setSelectedProfessionName(professionName);
        setSelectedProfessionDescription('');
        setShowProfessionDetailModal(true);

        try {
            const apiKey = ""; // Canvas will provide this at runtime
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const prompt = `Предоставь подробное описание профессии "${professionName}", включая типичные задачи, необходимые навыки (как hard, так и soft skills), перспективы карьерного роста и среднюю зарплату (укажи, что это приблизительные данные).`;

            const payload = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                setSelectedProfessionDescription(result.candidates[0].content.parts[0].text);
            } else {
                setSelectedProfessionDescription("Не удалось сгенерировать описание для этой профессии.");
            }
        } catch (error) {
            console.error("Error generating profession description:", error);
            setSelectedProfessionDescription(`Ошибка при генерации описания: ${error.message}`);
        } finally {
            setIsGeneratingDescription(false);
        }
    };


    // --- Results Component Logic ---
    const copyResultsToClipboard = () => {
        let resultsText = "Мои карьерные рекомендации от Tandau:\n\n";
        if (recommendations?.professions && recommendations.professions.length > 0) {
            resultsText += "Рекомендованные профессии:\n" + recommendations.professions.join('\n') + "\n\n";
        }
        if (recommendations?.universities && (recommendations.universities.local.length > 0 || recommendations.universities.international.length > 0 || recommendations.universities.all.length > 0)) {
            if (recommendations.universities.local.length > 0) {
                resultsText += "Местные вузы:\n" + recommendations.universities.local.join('\n') + "\n";
            }
            if (recommendations.universities.international.length > 0) {
                resultsText += "Международные вузы:\n" + recommendations.universities.international.join('\n') + "\n";
            }
            if (recommendations.universities.all.length > 0 && recommendations.universities.local.length === 0 && recommendations.universities.international.length === 0) {
                 resultsText += "Рекомендованные вузы:\n" + recommendations.universities.all.join('\n') + "\n";
            }
            resultsText += "\n";
        }
        if (recommendations?.courses && recommendations.courses.length > 0) {
            resultsText += "Рекомендованные онлайн-курсы:\n" + recommendations.courses.join('\n') + "\n\n";
        }
        if (recommendations?.internships && (recommendations.internships.local.length > 0 || recommendations.internships.international.length > 0 || recommendations.internships.all.length > 0)) {
            if (recommendations.internships.local.length > 0) {
                resultsText += "Местные стажировки:\n" + recommendations.internships.local.join('\n') + "\n";
            }
            if (recommendations.internships.international.length > 0) {
                resultsText += "Международные стажировки:\n" + recommendations.internships.international.join('\n') + "\n";
            }
            if (recommendations.internships.all.length > 0 && recommendations.internships.local.length === 0 && recommendations.internships.international.length === 0) {
                resultsText += "Рекомендованные стажировки:\n" + recommendations.internships.all.join('\n') + "\n";
            }
            resultsText += "\n";
        }
        if (recommendations?.individualPlan && recommendations.individualPlan.length > 0) {
            resultsText += "Индивидуальный план на год:\n" + recommendations.individualPlan.join('\n') + "\n\n";
        }

        // Using document.execCommand('copy') for clipboard functionality in iframe
        const textArea = document.createElement("textarea");
        textArea.value = resultsText;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'Результаты скопированы в буфер обмена!' : 'Не удалось скопировать результаты.';
            setModalMessage(msg);
            setShowModal(true);
        } catch (err) {
            console.error('Failed to copy text:', err);
            setModalMessage('Ошибка при копировании в буфер обмена.');
            setShowModal(true);
        }
        document.body.removeChild(textArea);
    };

    // --- UI Rendering ---
    const renderPage = () => {
        if (!isAuthReady) {
            return (
                <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-600 to-blue-500 text-white">
                    <div className="text-center p-8 rounded-lg shadow-xl bg-white bg-opacity-20 backdrop-filter backdrop-blur-lg">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                        <p className="text-xl font-semibold">Загрузка приложения...</p>
                    </div>
                </div>
            );
        }

        switch (currentPage) {
            case 'home':
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
                        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-2xl w-full text-center transform transition-all duration-500 scale-100 opacity-100">
                            <h1 className="text-5xl font-extrabold text-gray-800 mb-6 font-inter">Tandau</h1>
                            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                                Tandau — это умное карьерное приложение, которое поможет вам определить свои сильные стороны,
                                выбрать подходящую профессию и получить персональные рекомендации для вашего карьерного пути.
                            </p>
                            <button
                                onClick={() => setCurrentPage('test')}
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
                            >
                                Начать свой путь
                            </button>
                            {userId && (
                                <p className="mt-4 text-sm text-gray-500">Ваш ID пользователя: <span className="font-mono break-all">{userId}</span></p>
                            )}
                        </div>
                    </div>
                );
            case 'test':
                return (
                    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
                        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-3xl w-full transform transition-all duration-500 scale-100 opacity-100">
                            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center font-inter">Профориентационный тест</h2>
                            {questions.map((q, index) => (
                                <div key={q.id} className="mb-6 bg-gray-50 p-5 rounded-lg shadow-sm">
                                    <p className="text-lg font-semibold text-gray-700 mb-3">{index + 1}. {q.question}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {q.options.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleTestAnswer(q.id, option.value)}
                                                className={`py-3 px-5 rounded-lg text-left transition-all duration-200
                                                    ${testResults[q.id] === option.value
                                                        ? 'bg-blue-600 text-white shadow-md'
                                                        : 'bg-gray-200 text-gray-800 hover:bg-blue-100'
                                                    } focus:outline-none focus:ring-2 focus:ring-blue-400`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="text-center mt-8">
                                <button
                                    onClick={startAIChat}
                                    disabled={Object.keys(testResults).length !== questions.length}
                                    className={`bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300
                                        ${Object.keys(testResults).length !== questions.length ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Перейти к ИИ-диалогу
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'chat':
                return (
                    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
                        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col h-[90vh]">
                            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center font-inter">Диалог с ИИ</h2>
                            <div ref={chatContainerRef} className="flex-grow overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 custom-scrollbar">
                                {chatHistory.map((msg, index) => (
                                    <div key={index} className={`mb-3 p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-blue-100 self-end ml-auto' : 'bg-gray-100 self-start mr-auto'}`}>
                                        <p className="text-sm font-semibold text-gray-700">{msg.role === 'user' ? 'Вы' : 'Tandau AI'}</p>
                                        <p className="text-gray-800 whitespace-pre-wrap">{msg.parts[0].text}</p>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-center items-center py-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                        <span className="ml-3 text-gray-600">ИИ думает...</span>
                                    </div>
                                )}
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const input = e.target.elements.chatInput.value;
                                    if (input.trim()) {
                                        sendToAI(input);
                                        e.target.elements.chatInput.value = '';
                                    }
                                }}
                                className="flex gap-2"
                            >
                                <input
                                    type="text"
                                    name="chatInput"
                                    placeholder="Задайте вопрос или уточните..."
                                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isLoading}
                                >
                                    Отправить
                                </button>
                                <button
                                    onClick={finishChatAndShowResults}
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all duration-200"
                                >
                                    Завершить
                                </button>
                            </form>
                        </div>
                    </div>
                );
            case 'results':
                return (
                    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
                        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-3xl w-full transform transition-all duration-500 scale-100 opacity-100">
                            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center font-inter">Ваши карьерные рекомендации</h2>
                            <p className="text-center text-gray-600 mb-8">
                                На основе ваших ответов и диалога с ИИ, Tandau подготовил для вас следующие рекомендации:
                            </p>

                            {recommendations ? (
                                <>
                                    <div className="flex flex-wrap justify-center gap-4 mb-8">
                                        <button
                                            onClick={() => setSelectedResultCategory('professions')}
                                            className={`py-3 px-6 rounded-full font-bold transition-all duration-300 shadow-lg
                                                ${selectedResultCategory === 'professions' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-blue-100'}`}
                                        >
                                            Профессии
                                        </button>
                                        <button
                                            onClick={() => setSelectedResultCategory('universities')}
                                            className={`py-3 px-6 rounded-full font-bold transition-all duration-300 shadow-lg
                                                ${selectedResultCategory === 'universities' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-green-100'}`}
                                        >
                                            Вузы
                                        </button>
                                        <button
                                            onClick={() => setSelectedResultCategory('courses')}
                                            className={`py-3 px-6 rounded-full font-bold transition-all duration-300 shadow-lg
                                                ${selectedResultCategory === 'courses' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-yellow-100'}`}
                                        >
                                            Курсы
                                        </button>
                                        <button
                                            onClick={() => setSelectedResultCategory('internships')}
                                            className={`py-3 px-6 rounded-full font-bold transition-all duration-300 shadow-lg
                                                ${selectedResultCategory === 'internships' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-red-100'}`}
                                        >
                                            Стажировки
                                        </button>
                                        <button
                                            onClick={() => setSelectedResultCategory('individualPlan')}
                                            className={`py-3 px-6 rounded-full font-bold transition-all duration-300 shadow-lg
                                                ${selectedResultCategory === 'individualPlan' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-purple-100'}`}
                                        >
                                            План
                                        </button>
                                    </div>

                                    {selectedResultCategory === 'professions' && recommendations.professions && recommendations.professions.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recommendations.professions.map((prof, i) => (
                                                <div key={i} className="bg-blue-50 p-4 rounded-lg shadow-md border-l-4 border-blue-500 flex flex-col justify-between">
                                                    <p className="font-medium text-gray-800 text-base mb-2">{prof}</p>
                                                    <button
                                                        onClick={() => generateProfessionDescription(prof.split(':')[0].trim())} // Extract name before colon
                                                        className="mt-auto bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold py-1 px-3 rounded-full shadow-sm transition-all duration-200 flex items-center self-end"
                                                    >
                                                        ✨ Подробнее
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedResultCategory === 'universities' && (recommendations.universities.local.length > 0 || recommendations.universities.international.length > 0 || recommendations.universities.all.length > 0) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recommendations.universities.local.length > 0 && (
                                                <div className="bg-green-50 p-4 rounded-lg shadow-md border-l-4 border-green-500">
                                                    <h4 className="font-bold text-green-800 text-lg mb-2">Местные вузы:</h4>
                                                    <ul className="list-disc list-inside text-gray-700 text-base space-y-1">
                                                        {recommendations.universities.local.map((uni, i) => <li key={i}>{uni}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {recommendations.universities.international.length > 0 && (
                                                <div className="bg-green-50 p-4 rounded-lg shadow-md border-l-4 border-green-500">
                                                    <h4 className="font-bold text-green-800 text-lg mb-2">Международные вузы:</h4>
                                                    <ul className="list-disc list-inside text-gray-700 text-base space-y-1">
                                                        {recommendations.universities.international.map((uni, i) => <li key={i}>{uni}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {recommendations.universities.all.length > 0 && recommendations.universities.local.length === 0 && recommendations.universities.international.length === 0 && (
                                                <div className="bg-green-50 p-4 rounded-lg shadow-md border-l-4 border-green-500 col-span-1 md:col-span-2">
                                                    <h4 className="font-bold text-green-800 text-lg mb-2">Рекомендованные вузы:</h4>
                                                    <ul className="list-disc list-inside text-gray-700 text-base space-y-1">
                                                        {recommendations.universities.all.map((uni, i) => <li key={i}>{uni}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedResultCategory === 'courses' && recommendations.courses && recommendations.courses.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recommendations.courses.map((course, i) => (
                                                <div key={i} className="bg-yellow-50 p-4 rounded-lg shadow-md border-l-4 border-yellow-500">
                                                    <p className="font-medium text-gray-800 text-base">{course}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {selectedResultCategory === 'internships' && (recommendations.internships.local.length > 0 || recommendations.internships.international.length > 0 || recommendations.internships.all.length > 0) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recommendations.internships.local.length > 0 && (
                                                <div className="bg-red-50 p-4 rounded-lg shadow-md border-l-4 border-red-500">
                                                    <h4 className="font-bold text-red-800 text-lg mb-2">Местные стажировки:</h4>
                                                    <ul className="list-disc list-inside text-gray-700 text-base space-y-1">
                                                        {recommendations.internships.local.map((intern, i) => <li key={i}>{intern}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {recommendations.internships.international.length > 0 && (
                                                <div className="bg-red-50 p-4 rounded-lg shadow-md border-l-4 border-red-500">
                                                    <h4 className="font-bold text-red-800 text-lg mb-2">Международные стажировки:</h4>
                                                    <ul className="list-disc list-inside text-gray-700 text-base space-y-1">
                                                        {recommendations.internships.international.map((intern, i) => <li key={i}>{intern}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {recommendations.internships.all.length > 0 && recommendations.internships.local.length === 0 && recommendations.internships.international.length === 0 && (
                                                <div className="bg-red-50 p-4 rounded-lg shadow-md border-l-4 border-red-500 col-span-1 md:col-span-2">
                                                    <h4 className="font-bold text-red-800 text-lg mb-2">Рекомендованные стажировки:</h4>
                                                    <ul className="list-disc list-inside text-gray-700 text-base space-y-1">
                                                        {recommendations.internships.all.map((intern, i) => <li key={i}>{intern}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedResultCategory === 'individualPlan' && recommendations.individualPlan && recommendations.individualPlan.length > 0 && (
                                        <div className="grid grid-cols-1 gap-4">
                                            {recommendations.individualPlan.map((plan, i) => (
                                                <div key={i} className="bg-purple-50 p-4 rounded-lg shadow-md border-l-4 border-purple-500">
                                                    <p className="font-medium text-gray-800 text-base">{plan}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Display message if selected category has no data */}
                                    {selectedResultCategory && (
                                        (selectedResultCategory === 'professions' && (!recommendations.professions || recommendations.professions.length === 0)) ||
                                        ((selectedResultCategory === 'universities') && (!recommendations.universities.local.length && !recommendations.universities.international.length && !recommendations.universities.all.length)) ||
                                        ((selectedResultCategory === 'courses') && (!recommendations.courses || recommendations.courses.length === 0)) ||
                                        ((selectedResultCategory === 'internships') && (!recommendations.internships.local.length && !recommendations.internships.international.length && !recommendations.internships.all.length)) ||
                                        ((selectedResultCategory === 'individualPlan') && (!recommendations.individualPlan || recommendations.individualPlan.length === 0))
                                    ) && (
                                        <p className="text-center text-gray-600 text-lg mt-8">
                                            Для этой категории пока нет рекомендаций. Пожалуйста, продолжите диалог с ИИ.
                                        </p>
                                    )}

                                    <div className="text-center mt-8 space-x-4 col-span-1 md:col-span-2">
                                        <button
                                            onClick={copyResultsToClipboard}
                                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
                                        >
                                            Скопировать результаты
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage('home')}
                                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-8 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300"
                                        >
                                            Начать заново
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-center text-gray-600 text-lg">
                                    Пока нет рекомендаций. Пожалуйста, пройдите тест и пообщайтесь с ИИ.
                                </p>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    // Modal for messages
    const Modal = ({ message, onClose }) => {
        if (!showModal) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                    <p className="text-lg font-semibold text-gray-800 mb-4">{message}</p>
                    <button
                        onClick={onClose}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full transition-all duration-200"
                    >
                        ОК
                    </button>
                </div>
            </div>
        );
    };

    // Modal for Profession Details
    const ProfessionDetailModal = ({ professionName, description, isLoading, onClose }) => {
        if (!showProfessionDetailModal) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">{professionName}</h3>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                            <span className="ml-3 text-gray-600">Генерация описания...</span>
                        </div>
                    ) : (
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed mb-6 max-h-96 overflow-y-auto custom-scrollbar">{description}</p>
                    )}
                    <div className="text-center">
                        <button
                            onClick={onClose}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full transition-all duration-200"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="font-inter">
            {renderPage()}
            <Modal message={modalMessage} onClose={() => setShowModal(false)} />
            <ProfessionDetailModal
                professionName={selectedProfessionName}
                description={selectedProfessionDescription}
                isLoading={isGeneratingDescription}
                onClose={() => setShowProfessionDetailModal(false)}
            />
        </div>
    );
}

export default App;
