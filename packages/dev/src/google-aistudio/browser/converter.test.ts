import {describe, expect, test} from "vitest";
import {convertMessages} from "./converter.js";

describe("Raw-Contents To Ouput-Contents", () => {
  test("test chat", async () => {
    const rowContents = [
      {
        Ua: "text",
        id: "ADE64000-F40E-4B5D-8D78-AB76DFCB7C67",
        role: "user",
        text: "你好，测试一下对话",
        Ya: 1,
        tokenCount: 6,
      },
      {
        id: "D188AA7A-5F86-4FE6-8D7C-10D356E3932D",
        Ua: "text",
        de: false,
        role: "model",
        text: "**Understanding the Intent**\n\nI've successfully identified the user's intent. The simple greeting indicates they want to test my functionality and observe my responses. It seems they're gauging my ability to understand and engage in basic conversation. My primary focus now is to ensure I respond appropriately.\n\n\n**Analyzing the Request**\n\nI've broken down the user's initial prompt. It's a simple test of my conversational abilities. I've pinpointed the key components: the greeting, the testing intent, and the implied expectation of a functional response. My current objective is to formulate a reply that is both welcoming and demonstrates my core competence. I plan to incorporate a question or statement that prompts further interaction.\n\n\n**Developing the Response**\n\nI've formulated a complete response now. The latest refinement involves incorporating a list of my capabilities to encourage further interaction and give the user options. I've focused on creating a balanced greeting, acknowledging their test request, and showcasing my abilities. The final response is designed to initiate a conversation and display my functionality effectively.\n\n\n**Formulating a Greeting**\n\nI'm now putting the finishing touches on my response.  I've balanced confirming my functionality with an invitation to engage. I've also incorporated a list of capabilities to facilitate further interaction and give the user options, ensuring a more dynamic conversation starter. My goal is to be both informative and friendly.\n\n\n**Composing a Response**\n\nMy response is ready for delivery. I've fine-tuned the wording to sound natural and engaging, offering a spectrum of potential interactions.  The final composition balances a warm greeting, acknowledgment of the test, and a friendly invitation for further conversation. The use of varied sentence structures helps establish a welcoming and interactive tone.\n\n\n**Formulating the Final Response**\n\nI've crafted and refined the final response. It includes a friendly greeting, confirms the test's reception, and explicitly lists my potential capabilities to entice further interaction. My closing is an open-ended question to encourage user engagement.\n\n\n**Crafting a Polished Response**\n\nThe final response has been crafted. It acknowledges the test, confirms my functionality, and provides diverse ways to engage. I've chosen a concise and comprehensive greeting, incorporating the capability showcase and a clear call to action. I feel the final version is very polished.\n\n\n",
        Ya: 1,
        tokenCount: 1383,
        thought: true,
        isJson: false,
        zf: {
          nj: [
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
          ],
          thinkingBudget: -1,
        },
        parts: [
          [
            null,
            "**Understanding the Intent**\n\nI've successfully identified the user's intent. The simple greeting indicates they want to test my functionality and observe my responses. It seems they're gauging my ability to understand and engage in basic conversation. My primary focus now is to ensure I respond appropriately.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Analyzing the Request**\n\nI've broken down the user's initial prompt. It's a simple test of my conversational abilities. I've pinpointed the key components: the greeting, the testing intent, and the implied expectation of a functional response. My current objective is to formulate a reply that is both welcoming and demonstrates my core competence. I plan to incorporate a question or statement that prompts further interaction.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Developing the Response**\n\nI've formulated a complete response now. The latest refinement involves incorporating a list of my capabilities to encourage further interaction and give the user options. I've focused on creating a balanced greeting, acknowledging their test request, and showcasing my abilities. The final response is designed to initiate a conversation and display my functionality effectively.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Formulating a Greeting**\n\nI'm now putting the finishing touches on my response.  I've balanced confirming my functionality with an invitation to engage. I've also incorporated a list of capabilities to facilitate further interaction and give the user options, ensuring a more dynamic conversation starter. My goal is to be both informative and friendly.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Composing a Response**\n\nMy response is ready for delivery. I've fine-tuned the wording to sound natural and engaging, offering a spectrum of potential interactions.  The final composition balances a warm greeting, acknowledgment of the test, and a friendly invitation for further conversation. The use of varied sentence structures helps establish a welcoming and interactive tone.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Formulating the Final Response**\n\nI've crafted and refined the final response. It includes a friendly greeting, confirms the test's reception, and explicitly lists my potential capabilities to entice further interaction. My closing is an open-ended question to encourage user engagement.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Crafting a Polished Response**\n\nThe final response has been crafted. It acknowledges the test, confirms my functionality, and provides diverse ways to engage. I've chosen a concise and comprehensive greeting, incorporating the capability showcase and a clear call to action. I feel the final version is very polished.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
        ],
        He: {
          finishReason: 0,
          safetyRatings: [],
        },
      },
      {
        Ua: "text",
        id: "BB8C8A66-FE57-4CE0-B6B3-CE917DE5BD3E",
        role: "model",
        text: "你好！测试收到，我在这里，一切正常。\n\n很高兴能和您对话。您可以随时向我提问、让我帮您写文章、翻译、做计划，或者只是随便聊聊天。\n\n请问有什么可以帮您的吗？",
        thought: false,
        isJson: false,
        tokenCount: 53,
        Ya: 1,
        parts: [
          [null, "你好！测试收到，我在这里，一切正常。\n\n很高兴能和您对话。您可以随时向我提"],
          [null, "问、让我帮您写文章、翻译、做计划，或者只是随便聊聊天。\n\n请问有什么可以帮"],
          [null, "您的吗？"],
        ],
        He: {
          finishReason: 1,
          safetyRatings: [],
        },
      },
      {
        Ua: "image",
        id: "1CB8ECED-FE14-4EB7-82AA-7CFFC3D8DDF5",
        role: "user",
        Wd: {
          url: "blob:https://aistudio.google.com/3aaef6f8-3f2f-43c3-b4c7-4fbfe819f3cc",
          mimeType: "image/png",
          Dc: "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",
        },
        zd: "blob:https://aistudio.google.com/939a0860-3c18-4963-867a-96a2bf673b48",
        Ya: 1,
        tokenCount: 259,
        Ta: {
          kind: "drive#file",
          id: "1KKMUcQMvbGE1aqy-QqpmLWywqFiaBr3S",
          name: "head.png",
          mimeType: "image/png",
        },
      },
      {
        Ua: "text",
        id: "19777111-2CBE-4542-8003-D28E5346CA9B",
        role: "user",
        text: "测试图片内容",
        Ya: 1,
        tokenCount: 4,
      },
      {
        id: "62A0AFEA-02CF-4ABD-BE54-1AD5EC6227C4",
        Ua: "text",
        de: false,
        role: "model",
        text: "**Focusing on Image Analysis**\n\nMy initial assessment is complete. I've successfully identified the primary subject as a 3D object and pinpointed the prominent checkerboard pattern. Further investigation will be directed towards analyzing the spatial orientation and any potential distortions in the pattern.\n\n\n**Assessing Image Features**\n\nMy focus is now on the composition and color. The image is a grayscale representation, featuring a 3D block with a checkered pattern. It's angled, displaying two surfaces. The block dominates the right and bottom, with a plain white background. I'm noting the block's partial appearance within the frame.\n\n\n**Summarizing Image Contents**\n\nI'm now putting together the core points to provide a comprehensive description. The image's grayscale nature, the 3D block with the checkerboard pattern, the angled view, and the plain white background are all coming together. I'm focusing on crafting a succinct and informative overview in Chinese that highlights the geometric and three-dimensional characteristics of the image.\n\n\n",
        Ya: 1,
        tokenCount: 430,
        thought: true,
        isJson: false,
        zf: {
          nj: [
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
          ],
          thinkingBudget: -1,
        },
        parts: [
          [
            null,
            "**Focusing on Image Analysis**\n\nMy initial assessment is complete. I've successfully identified the primary subject as a 3D object and pinpointed the prominent checkerboard pattern. Further investigation will be directed towards analyzing the spatial orientation and any potential distortions in the pattern.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Assessing Image Features**\n\nMy focus is now on the composition and color. The image is a grayscale representation, featuring a 3D block with a checkered pattern. It's angled, displaying two surfaces. The block dominates the right and bottom, with a plain white background. I'm noting the block's partial appearance within the frame.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Summarizing Image Contents**\n\nI'm now putting together the core points to provide a comprehensive description. The image's grayscale nature, the 3D block with the checkerboard pattern, the angled view, and the plain white background are all coming together. I'm focusing on crafting a succinct and informative overview in Chinese that highlights the geometric and three-dimensional characteristics of the image.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
        ],
        He: {
          finishReason: 0,
          safetyRatings: [],
        },
      },
      {
        Ua: "text",
        id: "9A77A603-1119-47FF-BE4B-CBCB184AAF1F",
        role: "model",
        text: "好的，图片测试收到。\n\n根据您提供的图片，我看到的是：\n\n*   **一个带有棋盘格（Checkerboard）图案的立体块**。\n*   这个图案由交替的**深色（黑色或深灰色）**和**浅色（浅灰色）**方格组成。\n*   图片是从一个**倾斜的角度**拍摄的，展示了物体的两个面和一个角，有很强的**立体感**和**几何感**。\n*   这是一张**黑白（或灰度）**图片。\n*   背景是纯白色，非常简洁。\n\n简单来说，这是一张展示棋盘格图案立体块一角的特写图片。",
        thought: false,
        isJson: false,
        tokenCount: 150,
        Ya: 1,
        parts: [
          [null, "好的，图片测试收到。\n\n根据您提供的图片，我看到的是：\n\n*   **一个带有棋盘格（"],
          [null, "Checkerboard）图案的立体块**。\n*   这个图案由交替的**深色（黑色或"],
          [null, "深灰色）**和**浅色（浅灰色）**方格组成。\n*   图片是从一个**"],
          [null, "倾斜的角度**拍摄的，展示了物体的两个面和一个角，有很强的**立体感**和"],
          [null, "**几何感**。\n*   这是一张**黑白（或灰度）**图片。\n*   背景是"],
          [null, "纯白色，非常简洁。\n\n简单来说，这是一张展示棋盘格图案立体块一角的特写图片。"],
        ],
        He: {
          finishReason: 1,
          safetyRatings: [],
        },
      },
      {
        Ua: "text",
        id: "text-input-chunk-id",
        role: "user",
        text: "",
        Ya: 1,
        tokenCount: 0,
      },
    ];

    const outputContents = [
      {
        role: "user",
        parts: [
          {
            text: "你好，测试一下对话",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "**Understanding the Intent**\n\nI've successfully identified the user's intent. The simple greeting indicates they want to test my functionality and observe my responses. It seems they're gauging my ability to understand and engage in basic conversation. My primary focus now is to ensure I respond appropriately.\n\n\n**Analyzing the Request**\n\nI've broken down the user's initial prompt. It's a simple test of my conversational abilities. I've pinpointed the key components: the greeting, the testing intent, and the implied expectation of a functional response. My current objective is to formulate a reply that is both welcoming and demonstrates my core competence. I plan to incorporate a question or statement that prompts further interaction.\n\n\n**Developing the Response**\n\nI've formulated a complete response now. The latest refinement involves incorporating a list of my capabilities to encourage further interaction and give the user options. I've focused on creating a balanced greeting, acknowledging their test request, and showcasing my abilities. The final response is designed to initiate a conversation and display my functionality effectively.\n\n\n**Formulating a Greeting**\n\nI'm now putting the finishing touches on my response.  I've balanced confirming my functionality with an invitation to engage. I've also incorporated a list of capabilities to facilitate further interaction and give the user options, ensuring a more dynamic conversation starter. My goal is to be both informative and friendly.\n\n\n**Composing a Response**\n\nMy response is ready for delivery. I've fine-tuned the wording to sound natural and engaging, offering a spectrum of potential interactions.  The final composition balances a warm greeting, acknowledgment of the test, and a friendly invitation for further conversation. The use of varied sentence structures helps establish a welcoming and interactive tone.\n\n\n**Formulating the Final Response**\n\nI've crafted and refined the final response. It includes a friendly greeting, confirms the test's reception, and explicitly lists my potential capabilities to entice further interaction. My closing is an open-ended question to encourage user engagement.\n\n\n**Crafting a Polished Response**\n\nThe final response has been crafted. It acknowledges the test, confirms my functionality, and provides diverse ways to engage. I've chosen a concise and comprehensive greeting, incorporating the capability showcase and a clear call to action. I feel the final version is very polished.\n\n\n",
          },
          {
            text: "你好！测试收到，我在这里，一切正常。\n\n很高兴能和您对话。您可以随时向我提问、让我帮您写文章、翻译、做计划，或者只是随便聊聊天。\n\n请问有什么可以帮您的吗？",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: "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",
            },
          },
          {
            text: "测试图片内容",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "**Focusing on Image Analysis**\n\nMy initial assessment is complete. I've successfully identified the primary subject as a 3D object and pinpointed the prominent checkerboard pattern. Further investigation will be directed towards analyzing the spatial orientation and any potential distortions in the pattern.\n\n\n**Assessing Image Features**\n\nMy focus is now on the composition and color. The image is a grayscale representation, featuring a 3D block with a checkered pattern. It's angled, displaying two surfaces. The block dominates the right and bottom, with a plain white background. I'm noting the block's partial appearance within the frame.\n\n\n**Summarizing Image Contents**\n\nI'm now putting together the core points to provide a comprehensive description. The image's grayscale nature, the 3D block with the checkerboard pattern, the angled view, and the plain white background are all coming together. I'm focusing on crafting a succinct and informative overview in Chinese that highlights the geometric and three-dimensional characteristics of the image.\n\n\n",
          },
          {
            text: "好的，图片测试收到。\n\n根据您提供的图片，我看到的是：\n\n*   **一个带有棋盘格（Checkerboard）图案的立体块**。\n*   这个图案由交替的**深色（黑色或深灰色）**和**浅色（浅灰色）**方格组成。\n*   图片是从一个**倾斜的角度**拍摄的，展示了物体的两个面和一个角，有很强的**立体感**和**几何感**。\n*   这是一张**黑白（或灰度）**图片。\n*   背景是纯白色，非常简洁。\n\n简单来说，这是一张展示棋盘格图案立体块一角的特写图片。",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: "INSERT_INPUT_HERE",
          },
        ],
      },
    ];
    expect(await convertMessages(rowContents)).toEqual(outputContents);
  });
  test("test functionCall", async() => {
    const rowContents = [
      {
        Ua: "text",
        id: "C93D4DDE-E6FF-4C2F-A231-924707C1F5EC",
        role: "user",
        text: "测试一下FunctionCall",
        Ya: 1,
        tokenCount: 5,
      },
      {
        id: "A0AB8072-0A41-4BC6-97C0-97AFD0A05749",
        Ua: "text",
        de: false,
        role: "model",
        text: "**Initiating Function Call Test**\n\nI've received a request to test function calling, indicated by the user's message. My initial focus is on the function call capability itself. I will start by setting up a basic testing scenario to verify its functionality.\n\n\n**Refining Parameter Requests**\n\nI'm now refining the parameter requests. The initial interpretation led me to understand the user just wanted a test of the function call.  I've re-evaluated the scenario and decided that the function `zzzz` needs specific values:  'aaa', 'bbb', 'ccc', and 'ddd' to be provided by the user before the test can proceed. The message is now crafted to request these parameters, explaining the required data types.\n\n\n",
        thought: true,
        Ya: 1,
        tokenCount: 255,
        isJson: false,
        zf: {
          nj: [
            {
              A: null,
            },
            {
              A: null,
            },
          ],
          thinkingBudget: -1,
        },
        parts: [
          [
            null,
            "**Initiating Function Call Test**\n\nI've received a request to test function calling, indicated by the user's message. My initial focus is on the function call capability itself. I will start by setting up a basic testing scenario to verify its functionality.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Refining Parameter Requests**\n\nI'm now refining the parameter requests. The initial interpretation led me to understand the user just wanted a test of the function call.  I've re-evaluated the scenario and decided that the function `zzzz` needs specific values:  'aaa', 'bbb', 'ccc', and 'ddd' to be provided by the user before the test can proceed. The message is now crafted to request these parameters, explaining the required data types.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
        ],
        He: {
          finishReason: 0,
          safetyRatings: [],
        },
      },
      {
        Ua: "text",
        id: "0E7499EC-4F78-4A10-B84C-817BE5A75657",
        role: "model",
        text: "好的，测试函数zzzz需要提供以下参数：aaa（数字），bbb（数字），ccc（布尔值），ddd（包含sss的对象，sss的值可以是'a1'，'b2'或'c3'）。请提供这些参数的值。",
        thought: false,
        isJson: false,
        tokenCount: 56,
        Ya: 1,
        parts: [
          [
            null,
            "好的，测试函数zzzz需要提供以下参数：aaa（数字），bbb（数字），ccc（布尔值",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            "CiIBVKhc7koevQX39ZMmWwpwwkHFIVjPZGgdbVuVka6yl199CnUBVKhc7pts33cmMyH23sQINeyKXJdAkWJtSA0f2KWewzmaTajbnHz9Sl25JG/sb3YL2BS1NmyjvF8fF54WgVVxvIB4VDJxAcZrOBpD9qGHxwMlZqvHiibB7hEMYaM9mwAdvEOIjA0Z/ZRhjEGAg3f060wMXYsKlAEBVKhc7mVwWWllZFQuD9M63dRn+71XD1wrUp9n0p2Q8cVyOBb3L6E1M5Xd9zgmKo722FS7lkYSLkI7Q1SL0q6KRdf6tI3NT+B2GpkNowAhHH7s0CearqicJYdBPK+q22kD4OONASnY7WpIbuMQ+uMUO0Q5A8UW5bW5LIEjTnzPEsNLD//GbD55gmHAR0/G+zzGnWnlCocBAVSoXO4XtGmFlqTzwErR5fsu6d2FjSbN6D3ecooHTqKXGJRzIgxQch+AKiUH7IqgMUrMuqnc+Aor+upLnBTroxC7PIyx4em4YBzVkLhdTvkTFZHY/W7ayGvVaj2SGRpb/LfP+apksQ902qnfKfmpRavaeVcGmivfxkkpFOUYYHnIZGdzuB8ECpIBAVSoXO4MrXHXM8MERiUcS9c4CwExiLaKxf3D97WZYFyl3NoKPyzv0kcEZHqhzNRvWZlxJDVLL4I9gRr4eBJ1aLAzCzA1Mzl2NoOi77JdaUbXZXuzEL/opsC0EczyUPMf5TivBnCsfRFT8AZpbh5VR4pTqjVf2TI7uugU0/fcYG4Wgzbe5vhrifOsTg1LGV8NzB8KhAEBVKhc7gvbovMwIruUyh8G7GcNpASoe2jrYPQ5xTQNguLuFHl2JhimQnGVimZwJ+sy8DGBw2AVAI7FSJ0+2wyy6rmQiOtP7MqWH3uciIu3Gtsokek5C8ArW+QIeMLIipNQp5KqG4iLF0mYP0YRHM5rkR6rzIVye1hOkIwIm/xLZJptLK0KmgEBVKhc7jOcO0Xxn6kgwlLoF2KxqxwejFOZn1NItn4cjytQcU3J3TuP1T5fR9kzCUMKhB8W3zeeIKX0ezwL1FSs6ll46h/m7L2GyxM4avdblHD5zjlZl/UsOQ7pE03ZGXm62nryUcfjXjioyEJkpcZU4ZQ5vMnSkeiUz8cBQfWgi/IxYwtGs3bNJIpjD5vutTgxJoVfZK2JPCcpCoUBAVSoXO6q72uB3rloCur3pMuANuumrLKTA6YLyKQyXqsqcPqyH6Mpfqr801S0wDQQVbVvRZYBXAE6ChD0F1mpxtKNSUEyJwiD3KfxZiYaoKqpn3il6surB23d3iE61Gt5mL+TB+8ehcq5PiWHlLa3MgjkW2K0w5EU2nLzPr1kFwG0UmXnxgp1AVSoXO5pUAekPWfK7+M3XjXOkES4HtVMhswO8ryguR4yw8i5cAmNE1aWClvWO7ySZf2/6z35UT8p8jic4C32Q66W9KNdV63qHnRULLnwq7QqLhBMNoEMBacg1/qVePnb7de0vQsDg2NLn5a646u+GBSEt1e0Co0BAVSoXO4mY3BYsp129TLsSbpDrAGMsUGExQz9PbiGzjIG/lXUE4eurtG+BQCpb4h0Jz1PKCdutc9TS3ab/O838oyhlnLN7tTDn53xdTyTfexRWKvUcm+osi49omCPdCogqP3rxkqETroIWrpmQi1YCc0OH0sHXLCKKgnv612xAcyrSM87EWq7fSMUBrKICmkBVKhc7h9FjoTwvDisLZiy2Q5UJ2I20S8pNhWKkRki8VjKq44XwWXG9KRJNhKJpCwGe3WSyWxHR1bvN2yiq7K0RVO1FBPyadYZ0sqnXhR+/U4LSTfM6wIyLVm94Owk0qfx56j9EjeQaasKPwFUqFzug/57uB5Ilz0mZIyKXAsbmXds/Az5ZT9noIJf+EMerkHJbwShyJhBrkrY22nV7TSiQ5Nct9P3W+AzbA==",
          ],
          [null, "），ddd（包含sss的对象，sss的值可以是'a1'，'b2'或'c3'）。请"],
          [null, "提供这些参数的值。"],
        ],
        He: {
          finishReason: 1,
          safetyRatings: [],
        },
      },
      {
        Ua: "text",
        id: "7F46D918-DF9C-49BA-9E94-6AAA3F920930",
        role: "user",
        text: "随便",
        Ya: 1,
        tokenCount: 2,
      },
      {
        id: "271EF3FF-9B7A-4395-9633-236E5617DF19",
        Ua: "text",
        role: "model",
        text: "**Investigating Parameters**\n\nI'm currently grappling with the parameters for the `zzzz` function. The user initially provided a vague instruction, so I'm trying to deduce the best course of action. I know it needs two parameters, `aaa` and `bbb`.  I will need to understand what specific values would be most relevant, considering the user's initial \"whatever\" response.\n\n\n**Generating the Call**\n\nI've moved past initial parameter deduction and am now generating values to construct the tool call. Considering the \"随便\" response, I've chosen random, plausible values for each of the function's four parameters. I'll test the function using these generated values to provide a practical example. My next action is building the specific call based on these values.\n\n\n**Devising a Test**\n\nI've decided to proceed with the generation of a test call for the `zzzz` function, given the \"随便\" response. Following that cue, I've now selected a set of random, but plausible, values for the four parameters.  Specifically, I've crafted a call using `aaa=1`, `bbb=2`, `ccc=True`, and `ddd={'sss': 'a1'}`. My current focus is formatting this into a test call to present to the user.\n\n\n",
        Ya: 1,
        tokenCount: 409,
        thought: true,
        isJson: false,
        zf: {
          nj: [
            {
              A: null,
            },
            {
              A: null,
            },
            {
              A: null,
            },
          ],
          thinkingBudget: -1,
        },
        parts: [
          [
            null,
            "**Investigating Parameters**\n\nI'm currently grappling with the parameters for the `zzzz` function. The user initially provided a vague instruction, so I'm trying to deduce the best course of action. I know it needs two parameters, `aaa` and `bbb`.  I will need to understand what specific values would be most relevant, considering the user's initial \"whatever\" response.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Generating the Call**\n\nI've moved past initial parameter deduction and am now generating values to construct the tool call. Considering the \"随便\" response, I've chosen random, plausible values for each of the function's four parameters. I'll test the function using these generated values to provide a practical example. My next action is building the specific call based on these values.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
          [
            null,
            "**Devising a Test**\n\nI've decided to proceed with the generation of a test call for the `zzzz` function, given the \"随便\" response. Following that cue, I've now selected a set of random, but plausible, values for the four parameters.  Specifically, I've crafted a call using `aaa=1`, `bbb=2`, `ccc=True`, and `ddd={'sss': 'a1'}`. My current focus is formatting this into a test call to present to the user.\n\n\n",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            1,
          ],
        ],
        He: {
          finishReason: 0,
          safetyRatings: [],
        },
      },
      {
        Ua: "function_call",
        de: false,
        id: "7F065FF0-FEDD-4F80-889E-284A0CB4E5B8",
        role: "model",
        Qg: {
          response: "GG",
        },
        parts: [
          [
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            [
              "zzzz",
              [
                [
                  ["ddd", [null, null, null, null, [[["sss", [null, null, "a1"]]]]]],
                  ["bbb", [null, 2]],
                  ["aaa", [null, 1]],
                  ["ccc", [null, null, null, 1]],
                ],
              ],
            ],
            null,
            null,
            null,
            "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",
          ],
        ],
        He: {
          finishReason: 1,
          safetyRatings: [],
        },
        mode: "render",
        Ya: 1,
        tokenCount: 50,
      },
      {
        id: "C3C4EBDA-F058-4426-BD3F-DE9779570D82",
        Ua: "text",
        role: "model",
        text: "OK. 已使用aaa=1, bbb=2, ccc=true, ddd={'sss':'a1'}来调用函数。",
        Ya: 1,
        thought: false,
        isJson: false,
        tokenCount: 31,
        parts: [
          [null, "OK. 已"],
          [null, "使用aaa=1, bbb=2, ccc=true, ddd={'sss"],
          [null, "':'a1'}来调用函数。"],
        ],
        He: {
          finishReason: 1,
          safetyRatings: [],
        },
      },
      {
        Ua: "text",
        id: "text-input-chunk-id",
        role: "user",
        text: "",
        Ya: 1,
        tokenCount: 0,
      },
    ];

    const outputContents = [
      {
        role: "user",
        parts: [
          {
            text: "测试一下FunctionCall",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "**Initiating Function Call Test**\n\nI've received a request to test function calling, indicated by the user's message. My initial focus is on the function call capability itself. I will start by setting up a basic testing scenario to verify its functionality.\n\n\n**Refining Parameter Requests**\n\nI'm now refining the parameter requests. The initial interpretation led me to understand the user just wanted a test of the function call.  I've re-evaluated the scenario and decided that the function `zzzz` needs specific values:  'aaa', 'bbb', 'ccc', and 'ddd' to be provided by the user before the test can proceed. The message is now crafted to request these parameters, explaining the required data types.\n\n\n",
          },
          {
            text: "好的，测试函数zzzz需要提供以下参数：aaa（数字），bbb（数字），ccc（布尔值），ddd（包含sss的对象，sss的值可以是'a1'，'b2'或'c3'）。请提供这些参数的值。",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: "随便",
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "**Investigating Parameters**\n\nI'm currently grappling with the parameters for the `zzzz` function. The user initially provided a vague instruction, so I'm trying to deduce the best course of action. I know it needs two parameters, `aaa` and `bbb`.  I will need to understand what specific values would be most relevant, considering the user's initial \"whatever\" response.\n\n\n**Generating the Call**\n\nI've moved past initial parameter deduction and am now generating values to construct the tool call. Considering the \"随便\" response, I've chosen random, plausible values for each of the function's four parameters. I'll test the function using these generated values to provide a practical example. My next action is building the specific call based on these values.\n\n\n**Devising a Test**\n\nI've decided to proceed with the generation of a test call for the `zzzz` function, given the \"随便\" response. Following that cue, I've now selected a set of random, but plausible, values for the four parameters.  Specifically, I've crafted a call using `aaa=1`, `bbb=2`, `ccc=True`, and `ddd={'sss': 'a1'}`. My current focus is formatting this into a test call to present to the user.\n\n\n",
          },
          {
            function_call: {
              name: "zzzz",
              args: {ddd: {sss: "a1"}, bbb: 2, aaa: 1, ccc: true},
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            function_response: {
              name: "zzzz",
              response: {
                output: "GG",
              },
            },
          },
        ],
      },
      {
        role: "model",
        parts: [
          {
            text: "OK. 已使用aaa=1, bbb=2, ccc=true, ddd={'sss':'a1'}来调用函数。",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            text: "INSERT_INPUT_HERE",
          },
        ],
      },
    ];
    expect(await convertMessages(rowContents)).toEqual(outputContents);
  });

const x = {
  id: "64958754-B1C0-4B02-88E6-70E1B4645C4D",
  role: "model",
  Ua: "function_call",
  parts: [
    {
      Nc: [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        {
          Nc: [
            "zzzz",
            {
              Nc: [
                new Map([
                  [
                    "ddd",
                    {
                      Nc: [
                        null,
                        null,
                        null,
                        null,
                        {
                          Nc: [
                            new Map([
                              [
                                "sss",
                                {
                                  Nc: [null, null, "a1"],
                                  B: {},
                                },
                              ],
                            ]),
                          ],
                        },
                      ],
                    },
                  ],
                  [
                    "bbb",
                    {
                      Nc: [null, 2],
                      B: {},
                    },
                  ],
                  [
                    "aaa",
                    {
                      Nc: [null, 1],
                      B: {},
                    },
                  ],
                  [
                    "ccc",
                    {
                      Nc: [null, null, null, 1],
                      B: {},
                    },
                  ],
                ]),
              ],
            },
          ],
        },
        null,
        null,
        null,
        "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",
      ],
    },
  ],
  He: {
    finishReason: 1,
  },
  tokenCount: 50,
  Ya: 1,
  Qg: {
    response: "GG",
  },
};

});
