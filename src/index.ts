import "./styles.css";

interface State {
    [key: string]: any;
}

interface Context extends State {
}

interface Observer {
    value: any;
    update: () => void;
}

interface Expression {
    (): any;
}

interface Expressions {
    [expressionName: string]: Expression;
}

interface ExpressionWithObserver extends Expression {
    observer: Observer;
}

abstract class Component {
    constructor() {
        const state = this.getState();

        const context: Context = {};

        // Make the state observable, then add to context

        Object
            .entries(state)
            .forEach(([key, initialValue]: [string, any]) => {
                let value = initialValue;
                const dependentExpressions: Array<ExpressionWithObserver> = [];

                Object.defineProperty(context, key, {
                    get: () => {
                        if (!dependentExpressions.includes(this.expressionInitiator)) {
                            dependentExpressions.push(this.expressionInitiator);
                        }
                        return value;
                    },
                    set: (newValue: any) => {
                        value = newValue;
                        dependentExpressions.forEach((dependentExpression) => {
                                dependentExpression.observer.update();
                        });
                    }
                });
            });

        const expressions: Expressions = this.getExpressions.bind(context)();

        // wrap the original render method to renderThenLazilyUpdateDOM, then add to expressions

        const self: Component = this;
        let timerForDOMUpdate: null | number = null
        expressions.render = function renderThenLazilyUpdateDOM() {
            const renderResult = self.render.bind(context)();

            if(timerForDOMUpdate !== null) {
                clearTimeout(timerForDOMUpdate)
            }
            timerForDOMUpdate = setTimeout(() => {
                    const parent = document.querySelector(self.el);
                    if (parent) {
                        parent.innerHTML = renderResult;
                    }
                })

            return renderResult;
        };

        // Make the expressions observable, then add to context

        Object.entries(expressions).forEach(
            ([expressionName, expression]: [string, ExpressionWithObserver]) => {
                const dependentExpressions: Array<ExpressionWithObserver> = [];

                expression.observer = {
                    value: undefined,
                    update: () => {
                        this.expressionInitiator = expression;
                        expression.observer.value = expression();
                        this.expressionInitiator = null;

                        dependentExpressions.forEach((dependentExpression) => {
                            dependentExpression.observer.update();
                        });
                    }
                };

                // initialize expression value with force update (microtask #1)
                Promise.resolve().then(expression.observer.update);

                Object.defineProperty(context, expressionName, {
                    get: () => {
                        if (!dependentExpressions.includes(this.expressionInitiator)) {
                            dependentExpressions.push(this.expressionInitiator);
                        }
                        return expression.observer?.value;
                    }
                });
            }
        );

        // call the created hook (microtask #2)
        Promise.resolve().then(this.created.bind(context));
    }

    [x: string]: any;

    private expressionInitiator: null | ExpressionWithObserver = null;

    protected abstract el: string;

    protected abstract getState(): State;

    protected abstract getExpressions(): Expressions;

    protected abstract created(): void;

    protected abstract render(): string;
}

class Clock extends Component {
    el = "#cat";

    getState() {
        return {
            timestamp: Date.now()
        };
    }

    getExpressions() {
        return {
            dateObject: () => new Date(this.timestamp),
            hours: () => this.dateObject.getHours(),
            minutes: () => this.dateObject.getMinutes(),
            seconds: () => this.dateObject.getSeconds(),
            hoursDegrees: () => (360 / 12) * this.hours,
            minutesDegrees: () => (360 / 60) * this.minutes,
            secondsDegrees: () => (360 / 60) * this.seconds,
        };
    }

    created() {
        setInterval(() => {
            this.timestamp = Date.now();
        }, 1000);
    }

    render() {
        const arrowLayouts = [
            this.hoursDegrees,
            this.minutesDegrees,
            this.secondsDegrees
        ].map((degrees: number) =>
            `<div class="arrow-layout" style="transform: rotateZ(${degrees}deg)">
                <div class="arrow"></div>
             </div>`)

        return `<div class="clock">
                    ${arrowLayouts.join('')}
                    <span class="label">H: ${this.hours} M: ${this.minutes} S: ${this.seconds}</span>
                </div>`;
    }
}

new Clock()
