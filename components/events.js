//events.js
function subscribe(eventName, listener) {
    if (typeof document !== "undefined") {
        document.addEventListener(eventName, listener)
    }
}

function unsubscribe(eventName, listener) {
    if (typeof document !== "undefined") {
        document.removeEventListener(eventName, listener)
    }
}

function publish(eventName, data) {
    if (typeof document !== "undefined") {
        //console.log("CustomEvent ", eventName, ": Dispatched")
        const event = new CustomEvent(eventName, { detail: data })
        document.dispatchEvent(event)
    }
}

export { publish, subscribe, unsubscribe }
