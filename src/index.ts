import "./styles.css";

interface State {
    [key: string]: any;
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
        const state = this.defineState();

        // Make the state observable, then add each to instance

        Object
            .entries(state)
            .forEach(([key, initialValue]: [string, any]) => {
                let value = initialValue;
                const dependentExpressions: Array<ExpressionWithObserver> = [];

                Object.defineProperty(this, key, {
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

        const expressions: Expressions = this.defineExpressions();

        // wrap the original defineRender method to renderThenLazilyUpdateDOM, then add to expressions

        const self: Component = this;
        let timerForDOMUpdate: null | number = null
        expressions.render = () => {
            const renderResult = this.defineRender();

            if(timerForDOMUpdate !== null) {
                clearTimeout(timerForDOMUpdate)
            }
            timerForDOMUpdate = setTimeout(() => {
                    const container = document.querySelector(self.container);
                    if (container) {
                        container.innerHTML = renderResult;
                    }
                })

            return renderResult;
        };

        // Make the expressions observable, then add each to instance

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

                // Initialize expression value with force update
                Promise.resolve().then(expression.observer.update);

                Object.defineProperty(this, expressionName, {
                    get: () => {
                        if (!dependentExpressions.includes(this.expressionInitiator)) {
                            dependentExpressions.push(this.expressionInitiator);
                        }
                        return expression.observer?.value;
                    }
                });
            }
        );

        // Call the created hook
        Promise.resolve().then(() => this.created());
    }

    [x: string]: any;

    private expressionInitiator: null | ExpressionWithObserver = null;

    protected abstract container: string;

    protected abstract defineState(): State;

    protected abstract defineExpressions(): Expressions;

    protected abstract created(): void;

    protected abstract defineRender(): string;
}

class Clock extends Component {
    container = "#clock";

    defineState() {
        return {
            timestamp: Date.now()
        };
    }

    defineExpressions() {
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

    defineRender() {
        const arrowLayouts = [
            this.hoursDegrees,
            this.minutesDegrees,
            this.secondsDegrees
        ].map((degrees: number, i: number) =>
            `<div class="arrow-layout" style="transform: rotateZ(${degrees}deg)">
                <div class="arrow" style="height: ${[15, 25, 30][i]}%"></div>
             </div>`)

        return `<div class="clock">
                    ${arrowLayouts.join('')}
                    <span class="label">H: ${this.hours} M: ${this.minutes} S: ${this.seconds}</span>
                </div>`;
    }
}

new Clock()
