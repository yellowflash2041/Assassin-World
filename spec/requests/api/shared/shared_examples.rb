# frozen_string_literal: true

RSpec.shared_examples "a JSON endpoint" do |expected_response_status|
  before do |example|
    submit_request(example.metadata)
  end

  def expect_schema_valid(schemer, params)
    valid = schemer.valid?(params)
    unless valid # for debugging
      puts
      puts "RESPONSE: #{params}"
      puts "VALIDATION DETAILS: #{schemer.validate(params).to_a[0]["details"]}"
    end
    expect(valid).to eq(true)
  end

  describe "response status" do
    it "returns expected response status" do
      expect(response.status).to eq(expected_response_status)
    end
  end

  describe "request body" do
    it "matches the documented request schema" do |example|
      schemer = JSONSchemer.schema(expected_request_schema)
      expect_schema_valid(schemer, params)
    end
  end

  describe "response body" do
    let(:json_response) { JSON.parse(response.body) }

    it "matches the documented response schema" do  |example|
      schemer = JSONSchemer.schema(
        expected_response_schema,
      )
      expect_schema_valid(schemer, json_response)
    end
  end
end
