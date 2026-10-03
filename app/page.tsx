"use client";



import {

  useCallback,

  useEffect,

  useRef,

  useState,

type FormEvent,

type KeyboardEvent,

} from "react";



type AgentState = "READY" | "LISTENING" | "THINKING" | "SPEAKING";



type Message = {

  id: number;

  role: "user" | "assistant";

  text: string;

  time: string;

};



type Order = {

  id: string;

  customer: string;

  product: string;

  price: string;

  status: string;

  notes: string;

};



type AgentResult = {

  text: string;

  intent: string;

  orderId: string | null;

  resolved: boolean;

  escalation: boolean;

  cancelOrderId?: string | null;

};



type CallSummary = {

  customer_intent: string;

  order_id: string | null;

  resolution_status: string;

  call_summary: string;

  orders_discussed: string[];

  escalation_required: boolean;

};



const ORDERS: Order[] = [

  {

    id: "ORD-101",

    customer: "Priya Sharma",

    product: "Vitamin C Serum (30ml)",

    price: "₹699",

    status: "Out for Delivery",

    notes: "BlueDart — BD-982103. Expected by 6 PM today",

  },

  {

    id: "ORD-102",

    customer: "Rahul Verma",

    product: "Hydrating Sunscreen SPF 50",

    price: "₹499",

    status: "Delivered",

    notes: "Delhivery — DL-441029. Delivered 14 days ago",

  },

  {

    id: "ORD-103",

    customer: "Ananya Patel",

    product: "Green Tea Face Wash + Toner",

    price: "₹850",

    status: "Processing",

    notes: "Ordered 3 hours ago. Eligible for cancellation",

  },

];



const INITIAL_MESSAGE: Message = {

  id: 1,

  role: "assistant",

  text: "Hello! I'm Aria, your AI customer support assistant for Aura Skincare. Start a call and I'll be ready to help.",

  time: "Ready",

};



function getTime() {

return new Date().toLocaleTimeString([], {

    hour: "2-digit",

    minute: "2-digit",

  });

}






function getOrderDetails(
  orderId: string,
  cancelledOrders: string[] = []
): Order | null {

  const normalized = orderId.toUpperCase();

  const order =
    ORDERS.find((item) => item.id.toUpperCase() === normalized) ?? null;

  if (!order) return null;

  if (cancelledOrders.includes(order.id)) {
    return {
      ...order,
      status: "Cancelled",
      notes: "Cancellation confirmed during this support session",
    };
  }

  return order;
}






function normalizeOrderId(text: string): string | null {
  const value = text.toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

  const explicitMatch = value.match(/\b(?:ORDER|ORD)\s*-?\s*(\d{1,3})\b/);
  if (explicitMatch) {
    let number = Number(explicitMatch[1]);
    if (number >= 1 && number <= 3) number += 100;
    if (number >= 101 && number <= 103) return `ORD-${String(number).padStart(3, "0")}`;
  }

  const bareNumber = value.match(/^\s*(\d{1,3})\s*$/);
  if (bareNumber) {
    const number = Number(bareNumber[1]);
    if (number >= 101 && number <= 103) return `ORD-${number}`;
    if (number >= 1 && number <= 3) return `ORD-${number + 100}`;
  }

  return null;
}

function detectIntent(text: string): string {

  const normalized = text.toLowerCase().trim();



if (

    normalized.includes("cancel") ||

    normalized.includes("cancellation") ||

    normalized.includes("cancel my")

  ) {

return "ORDER_CANCELLATION";

  }



if (

    normalized.includes("return") ||

    normalized.includes("refund") ||

    normalized.includes("money back")

  ) {

return "RETURN_REFUND";

  }



if (

    normalized.includes("cod") ||

    normalized.includes("cash on delivery") ||

    normalized.includes("cash delivery") ||

    normalized === "upi" ||

    normalized.includes("pay at doorstep")

  ) {

return "COD_INFORMATION";

  }



if (

    normalized.includes("shipping") ||

    normalized.includes("shipping fee") ||

    normalized.includes("delivery charge") ||

    normalized.includes("delivery fee") ||

    normalized.includes("how long") ||

    normalized.includes("how many days")

  ) {

return "SHIPPING_POLICY";

  }



if (

    normalized.includes("order") ||

    normalized.includes("track") ||

    normalized.includes("status") ||

    normalized.includes("where is") ||

    normalized.includes("where's") ||

    normalized.includes("arrive") ||

    normalized.includes("delivered") ||

    normalized.includes("delivery")

  ) {

return "ORDER_TRACKING";

  }



if (

    normalized.includes("hello") ||

    normalized.includes("hi") ||

    normalized.includes("hey") ||

    normalized.includes("namaste")

  ) {

return "GREETING";

  }



if (

    normalized.includes("flight") ||

    normalized.includes("hotel") ||

    normalized.includes("restaurant") ||

    normalized.includes("movie") ||

    normalized.includes("weather") ||

    normalized.includes("book a")

  ) {

return "OUT_OF_SCOPE";

  }



if (

    normalized.includes("human") ||

    normalized.includes("manager") ||

    normalized.includes("complaint") ||

    normalized.includes("speak to someone") ||

    normalized.includes("speak to a person") ||

    normalized.includes("real person")

  ) {

return "HUMAN_ESCALATION";

  }



return "GENERAL_SUPPORT";

}






function generateResponse(

text: string,

previousMessages: Message[],

lastOrderId: string | null,

pendingIntent: string | null,

cancelledOrders: string[] = []

): AgentResult {

  const normalized = text.toLowerCase().trim();



  const extractedOrderId = normalizeOrderId(text);

  const currentIntent = detectIntent(text);





  const isOrderOnly =

    Boolean(extractedOrderId) &&

    (normalized.length <= 25 ||

      normalized.startsWith("ord") ||

      normalized.startsWith("order"));



  const effectiveOrderId = extractedOrderId ?? lastOrderId;



  let intent = currentIntent;



if (

    isOrderOnly &&

    pendingIntent &&

    [

      "ORDER_TRACKING",

      "ORDER_CANCELLATION",

      "RETURN_REFUND",

    ].includes(pendingIntent)

  ) {

    intent = pendingIntent;

  }





if (

!extractedOrderId &&

    lastOrderId &&

    (normalized.includes("when will") ||

      normalized.includes("when should") ||

      normalized.includes("when does") ||

      normalized.includes("arrive") ||

      normalized.includes("status") ||

      normalized.includes("where is") ||

      normalized.includes("tracking"))

  ) {

    intent = "ORDER_TRACKING";

  }





if (

    normalized === "upi" &&

    (pendingIntent === "COD_INFORMATION" ||

      previousMessages.some((message) =>

        message.text.toLowerCase().includes("cod")

      ))

  ) {

return {

      text: "Yes. Cash on Delivery supports both cash and UPI payment at the doorstep, for eligible orders up to ₹2,500.",

      intent: "COD_INFORMATION",

      orderId: null,

      resolved: true,

      escalation: false,

    };

  }






if (intent === "OUT_OF_SCOPE") {

return {

      text: "I'm sorry, but I can only help with Aura Skincare customer support. I can assist with orders, delivery, returns, cancellations, shipping, and payment information.",

      intent: "OUT_OF_SCOPE",

      orderId: null,

      resolved: true,

      escalation: false,

    };

  }






if (intent === "SHIPPING_POLICY") {

return {

      text: "Aura Skincare offers free delivery on orders above ₹499. Orders below ₹499 have a ₹50 shipping fee. Standard delivery usually takes 3 to 5 business days.",

      intent: "SHIPPING_POLICY",

      orderId: null,

      resolved: true,

      escalation: false,

    };

  }






if (intent === "RETURN_REFUND") {

    const opened =

      normalized.includes("opened") ||

      normalized.includes("open") ||

      normalized.includes("used");



    const outsideWindow =

      normalized.includes("20 days") ||

      normalized.includes("20 day") ||

      normalized.includes("10 days") ||

      normalized.includes("15 days");



if (opened || outsideWindow) {

return {

        text: "I'm sorry, but that request falls outside Aura Skincare's return policy. Returns are accepted within 7 days of delivery for products that are unopened and unused in their original packaging. Damaged or defective products should be reported within 48 hours with photos for replacement.",

        intent: "RETURN_REFUND",

        orderId: effectiveOrderId,

        resolved: true,

        escalation: false,

      };

    }



return {

      text: "Aura Skincare accepts returns within 7 days of delivery for products that are unopened, unused, and in their original packaging. Damaged or defective products must be reported within 48 hours of delivery with photos for replacement.",

      intent: "RETURN_REFUND",

      orderId: effectiveOrderId,

      resolved: true,

      escalation: false,

    };

  }






if (intent === "ORDER_CANCELLATION") {

  const cancellationOrderId = extractedOrderId ?? lastOrderId;

  if (!cancellationOrderId) {
    return {
      text: "I can help cancel an eligible order. Please provide your order ID, such as ORD-101, ORD-102, or ORD-103.",
      intent: "ORDER_CANCELLATION",
      orderId: null,
      resolved: false,
      escalation: false,
    };
  }

  const order = getOrderDetails(cancellationOrderId, cancelledOrders);

  if (!order) {
    return {
      text: `I couldn't locate ${cancellationOrderId} in our order database. Could you please verify the order ID?`,
      intent: "ORDER_CANCELLATION",
      orderId: cancellationOrderId,
      resolved: false,
      escalation: false,
    };
  }

  if (order.status === "Cancelled") {
    return {
      text: `${cancellationOrderId} has already been cancelled successfully.`,
      intent: "ORDER_CANCELLATION",
      orderId: cancellationOrderId,
      resolved: true,
      escalation: false,
    };
  }

  if (order.status !== "Processing") {
    return {
      text: `${cancellationOrderId} is currently ${order.status}. According to Aura Skincare's policy, orders can only be cancelled while they are Processing, so this order cannot be cancelled.`,
      intent: "ORDER_CANCELLATION",
      orderId: cancellationOrderId,
      resolved: true,
      escalation: false,
    };
  }

  const isConfirmation =
    /^(yes|yeah|yep|sure|okay|ok|please do|do it|confirm|confirmed|cancel it|yes cancel|haan|ha|ji|kar do|cancel kar do)/i.test(normalized) &&
    previousMessages.some(
      (message) =>
        message.role === "assistant" &&
        message.text.toLowerCase().includes("eligible for cancellation")
    );

  if (isConfirmation) {
    return {
      text: `Done. ${cancellationOrderId} has been cancelled successfully. The order status is now Cancelled.`,
      intent: "ORDER_CANCELLATION",
      orderId: cancellationOrderId,
      resolved: true,
      escalation: false,
      cancelOrderId: cancellationOrderId,
    };
  }

  return {
    text: `${cancellationOrderId} is currently Processing and is eligible for cancellation. Would you like me to cancel this order?`,
    intent: "ORDER_CANCELLATION",
    orderId: cancellationOrderId,
    resolved: false,
    escalation: false,
  };
}



if (intent === "ORDER_TRACKING") {

if (!effectiveOrderId) {

return {

        text: "Sure, I can check that for you. Please provide your order ID, for example ORD-101, ORD-102, or ORD-103.",

        intent: "ORDER_TRACKING",

        orderId: null,

        resolved: false,

        escalation: false,

      };

    }



    const order = getOrderDetails(effectiveOrderId, cancelledOrders);



if (!order) {

return {

        text: `I couldn't locate ${effectiveOrderId}. Could you please repeat or verify the order ID?`,

        intent: "ORDER_TRACKING",

        orderId: effectiveOrderId,

        resolved: false,

        escalation: false,

      };

    }



return {

      text: `${order.id} is currently ${order.status}. Your ${order.product} is priced at ${order.price}. ${order.notes}.`,

      intent: "ORDER_TRACKING",

      orderId: order.id,

      resolved: true,

      escalation: false,

    };

  }





if (extractedOrderId) {

    const order = getOrderDetails(extractedOrderId, cancelledOrders);



if (order) {

return {

        text: `${order.id} is currently ${order.status}. Your ${order.product} is priced at ${order.price}. ${order.notes}.`,

        intent: "ORDER_TRACKING",

        orderId: order.id,

        resolved: true,

        escalation: false,

      };

    }



return {

      text: `I couldn't locate ${extractedOrderId} in our order database. Could you please verify the order ID?`,

      intent: "ORDER_TRACKING",

      orderId: extractedOrderId,

      resolved: false,

      escalation: false,

    };

  }






if (normalized.includes("bye") || normalized.includes("goodbye")) {

return {

      text: "Thank you for contacting Aura Skincare. Have a wonderful day!",

      intent: "GENERAL_SUPPORT",

      orderId: effectiveOrderId,

      resolved: true,

      escalation: false,

    };

  }



return {

    text: "I can help you with Aura Skincare orders, delivery status, returns, refunds, cancellations, shipping, and COD information. What would you like help with?",

    intent: "GENERAL_SUPPORT",

    orderId: effectiveOrderId,

    resolved: false,

    escalation: false,

  };

}






export default function Home() {

  const [callActive, setCallActive] = useState(false);

  const [agentState, setAgentState] = useState<AgentState>("READY");

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);

  const [input, setInput] = useState("");

  const [duration, setDuration] = useState(0);

  const [ordersUsed, setOrdersUsed] = useState(0);
  const [cancelledOrders, setCancelledOrders] = useState<string[]>([]);

  const [isListening, setIsListening] = useState(false);

  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);

  const [currentIntent, setCurrentIntent] = useState("READY");

  const [escalationDetected, setEscalationDetected] = useState(false);



// Conversation memory

  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  const [pendingIntent, setPendingIntent] = useState<string | null>(null);

  const [discussedOrders, setDiscussedOrders] = useState<string[]>([]);



  const recognitionRef = useRef<any>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);

  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(

    null

  );






  const speak = useCallback(

    (text: string, onFinished?: () => void) => {

if (typeof window === "undefined") return;



      window.speechSynthesis.cancel();



      const utterance = new SpeechSynthesisUtterance(text);



      utterance.rate = 0.86;

      utterance.pitch = 1.02;

      utterance.volume = 0.82;



      const voices = window.speechSynthesis.getVoices();



      const preferredVoice =

        voices.find((voice) =>

          voice.name.toLowerCase().includes("samantha")

        ) ||

        voices.find((voice) =>

          voice.name.toLowerCase().includes("ava")

        ) ||

        voices.find((voice) =>

          voice.name.toLowerCase().includes("karen")

        ) ||

        voices.find((voice) =>

          voice.name.toLowerCase().includes("google us english")

        ) ||

        voices.find((voice) =>

          voice.lang.toLowerCase().startsWith("en-in")

        ) ||

        voices.find((voice) =>

          voice.lang.toLowerCase().startsWith("en")

        );



if (preferredVoice) {

        utterance.voice = preferredVoice;

      }



      utterance.onstart = () => {

        setAgentState("SPEAKING");

      };



      utterance.onend = () => {

if (callActive) {

          setAgentState("LISTENING");

        }



        onFinished?.();

      };



      utterance.onerror = () => {

if (callActive) {

          setAgentState("LISTENING");

        }



        onFinished?.();

      };



      window.speechSynthesis.speak(utterance);

    },

    [callActive]

  );






  const addMessage = useCallback(

    (role: "user" | "assistant", text: string) => {

      setMessages((current) => [

...current,

        {

          id: Date.now() + Math.random(),

          role,

          text,

          time: getTime(),

        },

      ]);

    },

    []

  );






  const startRecognition = useCallback(() => {

if (typeof window === "undefined") return;



    const SpeechRecognition =

      (window as any).SpeechRecognition ||

      (window as any).webkitSpeechRecognition;



if (!SpeechRecognition) {

      addMessage(

        "assistant",

        "Voice recognition is not supported by this browser. You can continue using the text input."

      );

return;

    }



if (recognitionRef.current) {

try {

        recognitionRef.current.stop();

      } catch {}

    }



    const recognition = new SpeechRecognition();



    recognition.continuous = false;

    recognition.interimResults = true;

    recognition.lang = "en-IN";

    recognition.maxAlternatives = 1;



    recognition.onstart = () => {

      setIsListening(true);

      setAgentState("LISTENING");

    };



    recognition.onresult = (event: any) => {

      let transcript = "";



for (

        let i = event.resultIndex;

        i < event.results.length;

        i++

      ) {

        transcript += event.results[i][0].transcript;

      }



      const finalResult =

        event.results[event.results.length - 1]?.isFinal;



if (finalResult) {

        const cleaned = transcript.trim();



if (cleaned) {

          setIsListening(false);

          handleUserMessage(cleaned, true);

        }

      }

    };



    recognition.onerror = (event: any) => {

      setIsListening(false);



if (event.error === "not-allowed") {

        addMessage(

          "assistant",

          "Microphone access is blocked. Please allow microphone access in your browser settings, or use the text input."

        );

      }



if (callActive) {

        setAgentState("LISTENING");

      } else {

        setAgentState("READY");

      }

    };



    recognition.onend = () => {

      setIsListening(false);



if (callActive) {

        setAgentState("LISTENING");

      }

    };



    recognitionRef.current = recognition;



try {

      recognition.start();

    } catch {

      setIsListening(false);

    }

  }, [addMessage, callActive]);






  const handleUserMessage = useCallback(

    (text: string, fromVoice = false) => {

      const cleaned = text.trim();



if (!cleaned || !callActive) return;



      addMessage("user", cleaned);

      setInput("");

      setAgentState("THINKING");



      const orderId = normalizeOrderId(cleaned);

      const detectedIntent = detectIntent(cleaned);





      const contextualIntent =

        orderId && pendingIntent

? pendingIntent

: detectedIntent;



if (

        contextualIntent !== "GENERAL_SUPPORT" &&

        contextualIntent !== "GREETING"

      ) {

        setCurrentIntent(contextualIntent);

      }



if (orderId) {

        setLastOrderId(orderId);



        setDiscussedOrders((current) => {

if (current.includes(orderId)) return current;

return [...current, orderId];

        });



        setOrdersUsed((current) =>

          discussedOrders.includes(orderId) ? current : current + 1

        );

      }





if (

        detectedIntent === "ORDER_TRACKING" ||

        detectedIntent === "ORDER_CANCELLATION" ||

        detectedIntent === "RETURN_REFUND" ||

        detectedIntent === "COD_INFORMATION"

      ) {

        setPendingIntent(detectedIntent);

      }



      const responseOrderId = orderId ?? lastOrderId;
    const responsePendingIntent =
      pendingIntent ??
      (detectedIntent === "ORDER_TRACKING" ||
      detectedIntent === "ORDER_CANCELLATION" ||
      detectedIntent === "RETURN_REFUND"
        ? detectedIntent
        : null);

    const response = generateResponse(
      cleaned,
      [...messages, { id: Date.now(), role: "user", text: cleaned, time: getTime() }],
      responseOrderId,
      responsePendingIntent,
      cancelledOrders
    );



if (response.orderId) {

        setLastOrderId(response.orderId);



        setDiscussedOrders((current) => {

if (current.includes(response.orderId!)) return current;

return [...current, response.orderId!];

        });

      }



      setCurrentIntent(response.intent);



if (response.cancelOrderId) {

        setCancelledOrders((current) =>
          current.includes(response.cancelOrderId!)
            ? current
            : [...current, response.cancelOrderId!]
        );

        setPendingIntent(null);

      }



if (response.escalation) {

        setEscalationDetected(true);

      }



      window.setTimeout(

        () => {

          addMessage("assistant", response.text);

          speak(response.text);

        },

        fromVoice ? 250 : 350

      );

    },

    [

      addMessage,

      callActive,

      discussedOrders,

      lastOrderId,

      messages,

      pendingIntent,

      cancelledOrders,

      speak,

    ]

  );






  const startCall = useCallback(() => {

if (callActive) return;



    window.speechSynthesis.cancel();



if (durationIntervalRef.current) {

      clearInterval(durationIntervalRef.current);

    }



    setCallSummary(null);

    setEscalationDetected(false);

    setCurrentIntent("GREETING");

    setCallActive(true);

    setDuration(0);

    setOrdersUsed(0);

    setLastOrderId(null);

    setPendingIntent(null);

    setDiscussedOrders([]);

    setMessages([]);



    durationIntervalRef.current = setInterval(() => {

      setDuration((current) => current + 1);

    }, 1000);



    const greeting =

      "Hello! I'm Aria, your AI customer support assistant for Aura Skincare. How can I help you today?";



    setMessages([

      {

        id: Date.now(),

        role: "assistant",

        text: greeting,

        time: getTime(),

      },

    ]);



    setTimeout(() => {

      speak(greeting, () => {

        setAgentState("LISTENING");

      });

    }, 250);

  }, [callActive, speak]);






  const createSummary = useCallback((): CallSummary => {

    const userMessages = messages.filter(

      (message) => message.role === "user"

    );



    const allText = userMessages

.map((message) => message.text)

.join(" ");



    const intent = detectIntent(allText);



    let summary =

      "Customer contacted Aura Skincare support.";



if (discussedOrders.length > 0) {

      const order = getOrderDetails(

        lastOrderId || discussedOrders[discussedOrders.length - 1]

      );



if (order) {

        summary = `Customer discussed ${order.id}. The agent provided the available order information and relevant policy guidance.`;

      } else {

        summary = `Customer discussed ${discussedOrders.join(

          " and "

        )}.`;

      }

    } else if (intent === "RETURN_REFUND") {

      summary =

        "Customer asked about Aura Skincare's return or refund policy.";

    } else if (intent === "ORDER_CANCELLATION") {

      summary =

        "Customer asked whether an order could be cancelled.";

    } else if (intent === "SHIPPING_POLICY") {

      summary =

        "Customer asked about Aura Skincare's shipping policy.";

    } else if (intent === "COD_INFORMATION") {

      summary =

        "Customer asked about Cash on Delivery and payment options.";

    }



    const resolutionStatus = escalationDetected

? "ESCALATION_REQUIRED"

: userMessages.length > 0

? "RESOLVED"

: "NO_CUSTOMER_REQUEST";



return {

      customer_intent: currentIntent || intent,

      order_id: lastOrderId,

      resolution_status: resolutionStatus,

      call_summary: summary,

      orders_discussed: discussedOrders,

      escalation_required: escalationDetected,

    };

  }, [

    currentIntent,

    discussedOrders,

    escalationDetected,

    lastOrderId,

    messages,

  ]);






  const endCall = useCallback(() => {

if (!callActive) return;



    window.speechSynthesis.cancel();



if (recognitionRef.current) {

try {

        recognitionRef.current.stop();

      } catch {}

    }



if (durationIntervalRef.current) {

      clearInterval(durationIntervalRef.current);

      durationIntervalRef.current = null;

    }



    const summary = createSummary();



    setCallSummary(summary);

    setCallActive(false);

    setIsListening(false);

    setAgentState("READY");

  }, [callActive, createSummary]);






  const handleMicClick = () => {

if (!callActive) {

      startCall();

return;

    }



if (agentState === "SPEAKING" || agentState === "THINKING") {

return;

    }



if (isListening) {

try {

        recognitionRef.current?.stop();

      } catch {}



      setIsListening(false);

      setAgentState("LISTENING");

return;

    }



    startRecognition();

  };






  const handleSubmit = (event: FormEvent) => {

    event.preventDefault();



if (!input.trim() || !callActive) return;



    handleUserMessage(input);

  };



  const handleKeyDown = (

event: KeyboardEvent<HTMLTextAreaElement>

  ) => {

if (event.key === "Enter" && !event.shiftKey) {

      event.preventDefault();



if (input.trim() && callActive) {

        handleUserMessage(input);

      }

    }

  };






  const testOrder = (orderId: string) => {

if (!callActive) {

      startCall();



      setTimeout(() => {

        handleUserMessage(

          `Can you tell me the status of ${orderId}?`

        );

      }, 1400);



return;

    }



    handleUserMessage(

      `Can you tell me the status of ${orderId}?`

    );

  };






  useEffect(() => {

    const element = transcriptRef.current;



if (!element) return;



    element.scrollTo({

      top: element.scrollHeight,

      behavior: "smooth",

    });

  }, [messages]);






  useEffect(() => {

return () => {

      window.speechSynthesis?.cancel();



try {

        recognitionRef.current?.stop();

      } catch {}



if (durationIntervalRef.current) {

        clearInterval(durationIntervalRef.current);

      }

    };

  }, []);



  const minutes = Math.floor(duration / 60)

.toString()

.padStart(2, "0");



  const seconds = (duration % 60)

.toString()

.padStart(2, "0");



  const stateLabel =

    agentState === "SPEAKING"

? "Speaking"

: agentState === "THINKING"

? "Thinking"

: agentState === "LISTENING"

? "Listening"

: "Ready";



  const stateDescription =

    agentState === "SPEAKING"

? "Aria is responding through your speakers."

: agentState === "THINKING"

? "Aria is processing your request."

: agentState === "LISTENING"

? "Aria is listening for your voice."

: "Start a call to begin.";



return (

    <main className="min-h-screen bg-[#050506] text-white">

      {/* HEADER */}



      <header className="sticky top-0 z-30 h-[72px] border-b border-white/10 bg-[#080809]/95 backdrop-blur-xl">

        <div className="mx-auto flex h-full max-w-[1700px] items-center justify-between px-5 lg:px-8">

          <div className="flex items-center gap-4">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-pink-600 text-lg font-black shadow-lg shadow-red-500/20">

              A

            </div>



            <div>

              <div className="text-base font-bold tracking-[0.18em]">

                AURA AI

              </div>



              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">

                Aura Skincare · CX Agent

              </div>

            </div>

          </div>



          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-white/50">

            <span

className={`h-2.5 w-2.5 rounded-full ${

                callActive

? "animate-pulse bg-emerald-400"

: "bg-white/25"

              }`}

            />



            {callActive ? "System Active" : "System Ready"}

          </div>

        </div>

      </header>



      <div className="mx-auto max-w-[1700px] px-5 py-6 lg:px-8 lg:py-8">

        {/* TITLE */}



        <section className="mb-6">

          <div className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-red-400">

            Live Agent

          </div>



          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">

            <div>

              <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl lg:text-6xl">

                Voice Support Console

              </h1>



              <p className="mt-3 max-w-2xl text-base leading-7 text-white/45 lg:text-lg">

                Test Aria using natural voice conversations or typed

                messages.

              </p>

            </div>



            <div className="flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3">

              <span

className={`h-2.5 w-2.5 rounded-full ${

                  agentState === "SPEAKING"

? "animate-pulse bg-red-400"

: agentState === "THINKING"

? "animate-pulse bg-purple-400"

: agentState === "LISTENING"

? "animate-pulse bg-emerald-400"

: "bg-white/25"

                }`}

              />



              <span className="text-sm font-bold uppercase tracking-[0.12em] text-white/60">

                {stateLabel}

              </span>

            </div>

          </div>

        </section>



        {/* MAIN CONSOLE */}



        <section className="grid min-h-[650px] gap-5 lg:grid-cols-[0.82fr_0.95fr_1.35fr]">

          {/* VOICE PANEL */}



          <div className="flex min-h-[650px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]">

            <div className="border-b border-white/10 px-6 py-5">

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">

                Primary Interaction

              </div>



              <h2 className="mt-2 text-2xl font-semibold">

                Talk to Aria

              </h2>



              <p className="mt-1 text-sm text-white/35">

                Voice first · Text fallback

              </p>

            </div>



            <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">

              <button

onClick={handleMicClick}

disabled={

!callActive ||

                  agentState === "SPEAKING" ||

                  agentState === "THINKING"

                }

className={`relative flex h-48 w-48 items-center justify-center rounded-full border transition-all duration-300 ${

                  agentState === "SPEAKING"

? "border-red-400/70 bg-red-500/15 shadow-[0_0_90px_rgba(239,68,68,0.3)]"

: agentState === "LISTENING"

? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_90px_rgba(16,185,129,0.2)]"

: agentState === "THINKING"

? "border-purple-400/60 bg-purple-500/10 shadow-[0_0_90px_rgba(168,85,247,0.2)]"

: "border-white/10 bg-white/[0.03]"

                }`}

              >

                {agentState === "LISTENING" && (

                  <>

                    <span className="absolute inset-[-18px] animate-pulse rounded-full border border-emerald-400/20" />

                    <span className="absolute inset-[-38px] animate-pulse rounded-full border border-emerald-400/10" />

                  </>

                )}



                {agentState === "SPEAKING" && (

                  <span className="absolute inset-[-18px] animate-pulse rounded-full border border-red-400/20" />

                )}



                <span className="relative text-6xl">

                  {agentState === "SPEAKING"

? "🔊"

: agentState === "THINKING"

? "◌"

: "🎙️"}

                </span>

              </button>



              <div className="mt-10 text-center">

                <div className="text-2xl font-semibold">

                  {agentState === "SPEAKING"

? "Aria is speaking"

: agentState === "THINKING"

? "Aria is thinking"

: agentState === "LISTENING"

? "Listening"

: "Ready to call"}

                </div>



                <p className="mt-3 max-w-xs text-sm leading-6 text-white/35">

                  {stateDescription}

                </p>

              </div>

            </div>



            <div className="border-t border-white/5 px-6 py-5">

              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em]">

                <span

className={

                    isListening

? "text-emerald-300"

: "text-white/25"

                  }

                >

                  {isListening

? "● Microphone active"

: "○ Microphone ready"}

                </span>



                <span className="text-white/30">

                  {callActive ? "Call active" : "No active call"}

                </span>

              </div>

            </div>

          </div>



          {/* TEXT PANEL */}



          <div className="flex min-h-[650px] flex-col overflow-hidden rounded-3xl border border-purple-500/10 bg-[#0a0a0c]">

            <div className="border-b border-white/10 px-6 py-5">

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300/70">

                Text Input

              </div>



              <h2 className="mt-2 text-2xl font-semibold">

                Type to Aria

              </h2>



              <p className="mt-1 text-sm text-white/35">

                Same agent · same conversation context

              </p>

            </div>



            <div className="flex flex-1 flex-col p-6">

              <div className="mb-5 flex items-center gap-3">

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15 text-lg font-bold text-purple-300">

                  Aa

                </div>



                <div>

                  <div className="font-semibold">

                    Text fallback

                  </div>



                  <div className="text-xs text-white/30">

                    Useful if microphone access is unavailable

                  </div>

                </div>

              </div>



              <form

onSubmit={handleSubmit}

className="flex flex-1 flex-col"

              >

                <textarea

value={input}

onChange={(event) =>

                    setInput(event.target.value)

                  }

onKeyDown={handleKeyDown}

disabled={!callActive}

placeholder={

                    callActive

? "Ask about an order, delivery, return, cancellation..."

: "Start a call to type a message..."

                  }

className="min-h-[240px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 p-5 text-lg leading-8 text-white outline-none transition placeholder:text-white/20 focus:border-purple-500/50 disabled:cursor-not-allowed disabled:opacity-40"

                />



                <div className="mt-4 flex items-center justify-between gap-4">

                  <span className="text-xs leading-5 text-white/25">

                    Enter to send

                    <br />

                    Shift + Enter for new line

                  </span>



                  <button

type="submit"

disabled={

!callActive || !input.trim()

                    }

className="rounded-xl bg-purple-600 px-7 py-3.5 text-sm font-bold uppercase tracking-[0.12em] transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"

                  >

                    Send →

                  </button>

                </div>

              </form>

            </div>



            <div className="border-t border-white/5 px-6 py-4">

              <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/20">

                Try: “Where is my order?” → “ORD 101”

              </div>

            </div>

          </div>



          {/* TRANSCRIPT PANEL */}



          <div className="flex min-h-[650px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]">

            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">

                  Conversation

                </div>



                <h2 className="mt-2 text-2xl font-semibold">

                  Call Transcript

                </h2>

              </div>



              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">

                <span

className={`h-2.5 w-2.5 rounded-full ${

                    callActive

? "animate-pulse bg-emerald-400"

: "bg-white/20"

                  }`}

                />



                <span className="text-white/35">

                  {callActive ? "Live" : "Saved"}

                </span>

              </div>

            </div>



            <div

ref={transcriptRef}

className="min-h-0 flex-1 overflow-y-auto px-6 py-6"

            >

              <div className="space-y-5">

                {messages.map((message) => (

                  <div

key={message.id}

className={`flex gap-3 ${

                      message.role === "user"

? "justify-end"

: "justify-start"

                    }`}

                  >

                    {message.role === "assistant" && (

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 font-bold text-red-300">

                        A

                      </div>

                    )}



                    <div

className={`max-w-[82%] ${

                        message.role === "user"

? "text-right"

: ""

                      }`}

                    >

                      <div className="mb-1.5 flex items-center gap-2">

                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">

                          {message.role === "assistant"

? "Aria"

: "You"}

                        </span>



                        <span className="text-xs text-white/20">

                          {message.time}

                        </span>

                      </div>



                      <div

className={`rounded-2xl px-4 py-3.5 text-[15px] leading-7 ${

                          message.role === "assistant"

? "border border-white/10 bg-white/[0.035] text-white/75"

: "bg-purple-600/20 text-white/90"

                        }`}

                      >

                        {message.text}

                      </div>

                    </div>

                  </div>

                ))}



                <div className="h-2" />

              </div>

            </div>



            <div className="border-t border-white/5 px-6 py-4">

              <div className="flex items-center justify-between text-xs text-white/25">

                <span>

                  {messages.length} messages

                </span>



                <span>

                  {lastOrderId

? `Context: ${lastOrderId}`

: "No order context"}

                </span>

              </div>

            </div>

          </div>

        </section>



        {/* CONTROLS */}



        <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#0a0a0c] p-5 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex flex-wrap gap-3">

            <button

onClick={startCall}

disabled={callActive}

className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-7 py-4 text-sm font-bold uppercase tracking-[0.12em] shadow-lg shadow-red-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-30"

            >

              ● Start Call

            </button>



            <button

onClick={endCall}

disabled={!callActive}

className="rounded-xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white/65 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-25"

            >

              ■ End Call

            </button>

          </div>



          <div className="flex items-center gap-6">

            <div>

              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/20">

                Duration

              </div>



              <div className="mt-1 font-mono text-xl font-semibold">

                {minutes}:{seconds}

              </div>

            </div>



            <div>

              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/20">

                Intent

              </div>



              <div className="mt-1 text-sm font-semibold text-purple-300">

                {currentIntent}

              </div>

            </div>

          </div>

        </section>



        {/* SECONDARY INFORMATION */}



        <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">

          {/* ORDERS */}



          <div className="rounded-3xl border border-white/10 bg-[#0a0a0c]">

            <div className="border-b border-white/10 px-6 py-5">

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">

                Test Orders

              </div>



              <h2 className="mt-2 text-2xl font-semibold">

                Sample Orders

              </h2>



              <p className="mt-1 text-sm text-white/35">

                Click an order to immediately test Aria's

                lookup tool.

              </p>

            </div>



            <div className="grid gap-3 p-5 md:grid-cols-3">

              {ORDERS.map((order) => (

                <button

key={order.id}

onClick={() => testOrder(order.id)}

className="group rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-left transition hover:border-red-500/30 hover:bg-red-500/[0.04]"

                >

                  <div className="flex items-center justify-between gap-2">

                    <span className="text-sm font-black tracking-[0.08em]">

                      {order.id}

                    </span>



                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/45">

                      {order.status}

                    </span>

                  </div>



                  <div className="mt-4 text-base font-semibold">

                    {order.product}

                  </div>



                  <div className="mt-3 text-sm text-white/40">

                    {order.customer}

                  </div>



                  <div className="mt-2 text-sm font-semibold text-white/60">

                    {order.price}

                  </div>



                  <div className="mt-3 text-xs leading-5 text-white/35">

                    {order.notes}

                  </div>



                  <div className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-red-400 opacity-70 transition group-hover:opacity-100">

                    Test Order →

                  </div>

                </button>

              ))}

            </div>

          </div>



          {/* SESSION */}



          <div className="rounded-3xl border border-white/10 bg-[#0a0a0c]">

            <div className="border-b border-white/10 px-6 py-5">

              <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">

                Call Status

              </div>



              <h2 className="mt-2 text-2xl font-semibold">

                Session

              </h2>

            </div>



            <div className="divide-y divide-white/5">

              <div className="flex items-center justify-between px-6 py-5">

                <div>

                  <div className="text-sm font-semibold">

                    Agent state

                  </div>



                  <div className="mt-1 text-xs text-white/30">

                    {callActive

? "Agent session active"

: "No active call"}

                  </div>

                </div>



                <div className="rounded-full bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/45">

                  {stateLabel}

                </div>

              </div>



              <div className="grid grid-cols-3">

                <div className="px-5 py-5">

                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/20">

                    Messages

                  </div>



                  <div className="mt-2 text-xl font-semibold">

                    {messages.length}

                  </div>

                </div>



                <div className="border-l border-white/5 px-5 py-5">

                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/20">

                    Orders

                  </div>



                  <div className="mt-2 text-xl font-semibold">

                    {ordersUsed}

                  </div>

                </div>



                <div className="border-l border-white/5 px-5 py-5">

                  <div className="text-[10px] uppercase tracking-[0.12em] text-white/20">

                    Duration

                  </div>



                  <div className="mt-2 text-xl font-semibold">

                    {minutes}:{seconds}

                  </div>

                </div>

              </div>



              <div className="px-6 py-5">

                <div className="text-[10px] uppercase tracking-[0.12em] text-white/20">

                  Conversation context

                </div>



                <div className="mt-2 text-sm font-semibold text-purple-300">

                  {lastOrderId

? lastOrderId

: "No order selected"}

                </div>

              </div>



              {escalationDetected && (

                <div className="px-6 py-5">

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">

                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-amber-300">

                      ⚠ Escalation detected

                    </div>



                    <p className="mt-2 text-xs leading-5 text-white/40">

                      Human support may be required.

                    </p>

                  </div>

                </div>

              )}

            </div>

          </div>

        </section>



        {/* KNOWLEDGE */}



        <section className="mt-5 rounded-3xl border border-white/10 bg-[#0a0a0c] p-6">

          <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">

            Agent Knowledge

          </div>



          <h2 className="mt-2 text-xl font-semibold">

            Aura Guardrails

          </h2>



          <div className="mt-5 grid gap-4 text-sm leading-6 text-white/45 md:grid-cols-4">

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">

              <span className="font-semibold text-white/70">

                Shipping

              </span>

              <p className="mt-1">

                Free above ₹499; ₹50 below ₹499; 3–5 business

                days.

              </p>

            </div>



            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">

              <span className="font-semibold text-white/70">

                Returns

              </span>

              <p className="mt-1">

                7 days after delivery; unopened and unused.

              </p>

            </div>



            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">

              <span className="font-semibold text-white/70">

                Cancellation

              </span>

              <p className="mt-1">

                Only while the order is Processing.

              </p>

            </div>



            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">

              <span className="font-semibold text-white/70">

                COD

              </span>

              <p className="mt-1">

                Available up to ₹2,500 with cash or UPI.

              </p>

            </div>

          </div>

        </section>



        {/* POST CALL SUMMARY */}



        {callSummary && (

          <section className="mt-5 overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#0a0d0b]">

            <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center">

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">

                  Post-Call Analysis

                </div>



                <h2 className="mt-2 text-2xl font-semibold">

                  Call Summary

                </h2>

              </div>



              <div

className={`w-fit rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] ${

                  callSummary.escalation_required

? "bg-amber-500/10 text-amber-300"

: "bg-emerald-500/10 text-emerald-300"

                }`}

              >

                {callSummary.escalation_required

? "Escalation Required"

: "Resolved"}

              </div>

            </div>



            <div className="grid gap-5 p-6 lg:grid-cols-2">

              <div className="space-y-4">

                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">

                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/25">

                    Customer Intent

                  </div>



                  <div className="mt-2 text-lg font-semibold">

                    {callSummary.customer_intent}

                  </div>

                </div>



                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">

                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/25">

                    Resolution Status

                  </div>



                  <div className="mt-2 text-lg font-semibold">

                    {callSummary.resolution_status}

                  </div>

                </div>



                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">

                  <div className="text-[10px] uppercase tracking-[0.15em] text-white/25">

                    Orders Discussed

                  </div>



                  <div className="mt-3 flex flex-wrap gap-2">

                    {callSummary.orders_discussed.length >

                    0 ? (

                      callSummary.orders_discussed.map(

                        (order) => (

                          <span

key={order}

className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300"

                          >

                            {order}

                          </span>

                        )

                      )

                    ) : (

                      <span className="text-sm text-white/35">

                        No order discussed

                      </span>

                    )}

                  </div>

                </div>

              </div>



              <div className="rounded-2xl border border-white/8 bg-black/20 p-5">

                <div className="text-[10px] uppercase tracking-[0.15em] text-white/25">

                  Structured Outcome

                </div>



                <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-5 text-xs leading-6 text-emerald-300">

                  {JSON.stringify(callSummary, null, 2)}

                </pre>

              </div>

            </div>



            <div className="border-t border-white/10 px-6 py-5">

              <div className="text-[10px] uppercase tracking-[0.15em] text-white/25">

                Call Summary

              </div>



              <p className="mt-2 text-sm leading-7 text-white/60">

                {callSummary.call_summary}

              </p>

            </div>

          </section>

        )}



        {/* FOOTER */}



        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pb-8 text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">

          <span>● Voice Enabled</span>

          <span>● Context Memory</span>

          <span>● Policy Guardrails</span>

          <span>● Order Tool</span>

          <span>● Live Transcript</span>

          <span>● Call Summary</span>

        </div>

      </div>

    </main>

  );

}
