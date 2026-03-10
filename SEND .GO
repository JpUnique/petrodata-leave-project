package main

        import (
            "context"
            "fmt"
            "time"

            "github.com/mailersend/mailersend-go"
        )

        var APIKey = "Api_Token_Here"

        func main() {
            ms := mailersend.NewMailersend(APIKey)

            ctx := context.Background()
            ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
            defer cancel()

            subject := "Subject"
            text := "Greetings from the team, you got this message through MailerSend."
            html := "Greetings from the team, you got this message through MailerSend."

            from := mailersend.From{
                Name:  "Your Name",
                Email: "info@domain.com",
            }

            recipients := []mailersend.Recipient{
                {
                    Name:  "Recipient",
                    Email: "recipient@email.com",
                },
            }

            variables := []mailersend.Variables{
                {
                    Email: "recipient@email.com",
                    Substitutions: []mailersend.Substitution{
                        {
                            Var:   "foo",
                            Value: "bar",
                        },
                    },
                },
            }

            tags := []string{"foo", "bar"}

            message := ms.Email.NewMessage()

            message.SetFrom(from)
            message.SetRecipients(recipients)
            message.SetSubject(subject)
            message.SetHTML(html)
            message.SetText(text)
            message.SetSubstitutions(variables)
            message.SetTags(tags)

            res, _ := ms.Email.Send(ctx, message)

            fmt.Printf(res.Header.Get("X-Message-Id"))

        }